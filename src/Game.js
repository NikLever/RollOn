import {
    Clock, Raycaster, Vector3, Scene, Color, PerspectiveCamera, HemisphereLight, DirectionalLight,
    WebGLRenderer, Vector2, Group, Mesh, SphereGeometry, PMREMGenerator, CubeTextureLoader, MeshBasicMaterial, Matrix4,
    Quaternion, VSMShadowMap, CameraHelper
} from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
//import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { Physics } from "./Physics"
import { Tween, JoyStick } from "./Toon3D"
import { SFX } from "./SFX"
import { UI } from "./UI"

export class Game{
    static modes = Object.freeze({
        NONE:   0,
        PRELOAD: 1,
        INITIALISING:  2,
        CREATING_LEVEL: 3,
        ACTIVE: 4,
        IN_CUP: 5,
        LEVEL_COMPLETE: 6,
        GAMEOVER: 7
    });

    constructor(){
        this.init();

        this.clock = new Clock();

        this.raycaster = new Raycaster();
        this.down = new Vector3(0, -1, 0);

        this.tmpVec3 = new Vector3();
        this.tmpVec3b = new Vector3();
        this.input = new Vector3();
        this.tmpQuat = new Quaternion();

        this.tmpMat4 = new Matrix4();

        this.store = {
            score: 0,
            levelIndex:1,
            balls: 5
        }

        this.stepPhysics = false;

        this.joystick = new JoyStick({ onMove: (x, z) => {
            this.input.x = z;
            this.input.z = -x;
        } });

        this.ui = new UI( this );
        //this.loadSounds();
    }

    logVector3( v, name, precision = 2 ){
        console.log( `${name} = ${v.x.toFixed(precision)}, ${v.y.toFixed(precision)}, ${v.z.toFixed(precision)}`)
    }

    loadSounds(){
        const snds = [
            'boing',
            'gliss',
            'in-cup',
            'light',
            'rolling',
            'swish',
            'win'
        ]

        this.sfx = new SFX(this.camera, "./sfx/");

        snds.forEach( snd => {
            this.sfx.load(snd, snd=="rolling");
        })
    }

    init(){
        this.scene = new Scene();
        this.scene.background = new Color( 0xaaaaaa );
    
        this.camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
        this.camera.position.set(0, 3.5, 6);

        const ambient = new HemisphereLight(0xffffff, 0xbbbbff, 0.5);
        this.scene.add(ambient);

        const light = new DirectionalLight(0xFFFFFF, 3);
        light.position.set( 2, 10, 10 );
        light.castShadow = true;
        light.shadow.camera.near = 0.5; // default
        light.shadow.camera.far = 50; // default
        const size = 10;
        light.shadow.camera.top = size;
        light.shadow.camera.right = size;
        light.shadow.camera.bottom = -size;
        light.shadow.camera.left = -size;
        light.shadow.radius = 2;
        light.shadow.blurSamples = 5;
        this.scene.add(light);

        //const shadowHelper = new CameraHelper(light.shadow.camera);
        //shadowHelper.name = 'shadowHelper';
        //this.scene.add(shadowHelper);

        this.renderer = new WebGLRenderer({antialias: true});
        this.renderer.setPixelRatio( Math.max(window.devicePixelRatio, 2) );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = VSMShadowMap;
        document.body.appendChild( this.renderer.domElement );
            
        const controls = new OrbitControls( this.camera, this.renderer.domElement );
        controls.target.y = 0.0;
        controls.update();
        controls.enablePan = controls.enableZoom = false;
        controls.minDistance = controls.maxDistance = 7;
        this.controls = controls;
            
        window.addEventListener( 'resize', this.resize.bind(this), false);

        this.setEnvironment();

        this.loadSkybox();
            
        this.loadBits();

    }

    nextLevel(){
        this.stepPhysics = false;
        this.ui.level++;
        this.loadLevel(this.ui.level);
    }

    async initPhysics(){
        this.physics = new Physics();
        await this.physics.initPhysics();

        if (this.level && this.physics.meshes.length == 0) this.initLevelPhysics();

        this.update();
    }

    loadSkybox(){
        this.scene.background = new CubeTextureLoader()
	        .setPath( './skyboxes/paintedsky/' )
            .load( [
                'px.jpg',
                'nx.jpg',
                'py.jpg',
                'ny.jpg',
                'pz.jpg',
                'nz.jpg'
            ], () => {
                //this.renderer.setAnimationLoop(this.render.bind(this));
            } );
    }

    initLevelPhysics(){
        this.physics.reset();
        this.physics.addMesh(this.ball, 0.5);
        this.physics.addMesh(this.collider);
        this.stepPhysics = true;
    }

    setEnvironment(){
        const loader = new RGBELoader();
        const pmremGenerator = new PMREMGenerator( this.renderer );
        pmremGenerator.compileEquirectangularShader();

        loader.load( 'venice_sunset_1k.hdr', ( texture ) => {
            const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
            pmremGenerator.dispose();

            this.scene.environment = envMap;

        }, undefined, (err)=>{
            console.error( 'An error occurred setting the environment.' + err.message );
        } );
    }

    loadBits(){
        const loader = new GLTFLoader( );
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath( 'draco-gltf/' );
        loader.setDRACOLoader( dracoLoader );

        // Load a glTF resource
        loader.load(
            // resource URL
            'bits.glb',
            // called when the resource is loaded
            gltf => {
                this.bits = {  };
                    
                gltf.scene.traverse( child => {

                    if (child.isMesh){
                        switch(child.name){
                            case "Ball":
                                this.bits[child.name] = child;
                                const geometry = new SphereGeometry(0.3);
                                this.ball = new Mesh(geometry, child.material);
                                this.ball.castShadow = true;
                                //console.log(`Game.loadBits ${child.name}`);
                                break;
                            default:
                                if (child.name.indexOf( '_' ) == -1){
                                    this.bits[child.name] = child;
                                    //console.log(`Game.loadBits ${child.name}`);
                                }
                                break;
                        }
                    }else{
                        this.bits[child.name] = child;
                        //console.log(`Game.loadBits ${child.name}`);
                    }

                });

                if ( this.ball ) this.scene.add(this.ball);

                this.initPhysics();

                this.loadLevel(this.ui.level);
            },
            // called while loading is progressing
            null,
            // called when loading has errors
            err => {

                console.error( err.message );

            }  
        );
    }

    clearLevel(){

        this.level.forEach( mesh => {
            if (!mesh.userData.noDispose){
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material && !mesh.name.startsWith("Level")){
                    if (mesh.material.map) mesh.material.map.dispose();
                    mesh.material.dispose();
                }
            }
            this.scene.remove(mesh);
        })
    }

    loadLevel(index){
        if ( this.level ) this.clearLevel();

        this.ui.level = index;

        const loader = new GLTFLoader( ).setPath('levels/');
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath( 'draco-gltf/' );
        loader.setDRACOLoader( dracoLoader );

        const name = (index<10) ? `level0${index}.glb` : `level${index}.glb`;

        // Load a glTF resource
        loader.load(
            // resource URL
            name,
            // called when the resource is loaded
            gltf => {
                this.level = [];
                this.spinners = [];
                this.teleports = [];
                let obj;
                gltf.scene.traverse( child => { 
                    obj = child;
                    if (child && child.name){
                        let name = child.name;
                        const idx = name.indexOf( '0' );
                        if (idx != -1) name = name.substring(0, idx);
                        //name.toLowerCase();
                        //console.log(`Game.loadLevel ${name}`)
                        switch(name){
                        case "Collider":
                            //child.visible = false;
                            this.collider = child;
                            //this.level.push(child);
                            break;
                        case "start":
                            this.ball.position.copy(child.position);
                            this.ball.userData.startPosition = child.position;
                            break;
                        case "finish":
                            this.arrow = this.bits['Arrow'].clone();
                            this.arrow.position.copy(child.position).add(this.tmpVec3.set(0, 2, 0));
                            this.arrow.userData.startPos = this.arrow.position.clone();
                            this.arrow.userData.elapsedTime = 0;
                            this.level.push(this.arrow);
                            this.arrow.userData.noDispose = true;
                            this.finish = child;
                            break;
                        case "Level":
                            this.level.push(child);
                            child.traverse( obj => {
                                if (obj.isMesh) obj.receiveShadow = true;
                            });
                            break;
                        case "Teleport":
                            const teleport = this.bits[name].clone();
                            teleport.position.copy(child.position);
                            this.level.push(teleport);
                            teleport.userData.noDispose = true;
                            this.teleports.push( teleport );
                            break;
                        case "Spinner":
                            const spinner = this.bits[name].clone();
                            spinner.position.copy(child.position);
                            this.level.push(spinner);
                            spinner.userData.noDispose = true;
                            this.spinners.push( spinner );
                            break;
                        }
                        if (name.startsWith("Box")){
                            const pickup = this.bits[name].clone();
                            pickup.position.copy(child.position);
                            this.setCastShadow( pickup );
                            this.level.push(pickup);
                            pickup.userData.noDispose = true;
                        }
                    }
                });

                this.level.forEach( mesh => {
                    this.scene.add(mesh);
                });

                this.tmpVec3.copy( this.ball.position ).sub( this.finish.position );
                this.tmpVec3.y = 0;
                this.tmpVec3.normalize().multiplyScalar( 5 );
                this.tmpVec3.y = 3;
                this.camera.position.copy( this.ball.position ).add( this.tmpVec3 );
                //this.logVector3( this.camera.position, 'camera before update' );
                this.controls.minDistance = 0;
                this.controls.maxDistance = 700;
                this.controls.update();
                this.controls.minDistance = this.controls.maxDistance = 7;

                //this.logVector3( this.ball.position, 'start' );
                //this.logVector3( this.finish.position, 'finish' );
                //this.logVector3( this.tmpVec3, 'offset' );
                //this.logVector3( this.camera.position, 'camera after update' );
                
                if (this.physics.isReady) this.initLevelPhysics();
            },
            // called while loading is progressing
            null,
            // called when loading has errors
            err => {

                console.error( err.message );

            }  
        );
    }

    setCastShadow( obj ){
        obj.traverse( child => {
            if (child.isMesh){
                child.castShadow = true;
            }
        })
    }

    spinStuff( dt ){
        if (this.arrow){
            this.arrow.rotateZ( 0.01 );
            this.arrow.userData.elapsedTime += dt;
            this.arrow.position.copy( this.arrow.userData.startPos );
            this.arrow.position.y +=  Math.sin( this.arrow.userData.elapsedTime ) * 0.5;
        }
        if (this.spinners) this.spinners.forEach( spinner => spinner.rotateZ( 0.1 ) );
        if (this.teleports) this.teleports.forEach( teleport => teleport.rotateZ( 0.03 ) );
    }

    reset(){
        this.ui.balls--;
        this.ball.position.copy( this.ball.userData.startPosition );
        this.initLevelPhysics();
    }

    update(){
        requestAnimationFrame( this.update.bind(this) );
        
        const dt = this.clock.getDelta();

        if (this.stepPhysics){
            if (this.input.x!=0 || this.input.z!=0){
                this.camera.getWorldQuaternion( this.tmpQuat );
                //this.camera.getWorldDirection(this.tmpVec3).multiply(this.input).multiplyScalar(0.1);
                this.tmpVec3.copy(this.input);
                this.tmpVec3.applyQuaternion(this.tmpQuat);
                this.tmpVec3.multiplyScalar(dt*4);
                //this.tmpVec3.set( this.input.x, 0, this.input.y ).multiplyScalar(0.1);
                this.physics.applyImpulse( this.ball, this.tmpVec3 )
            }
            this.physics.step();

            if (this.ball.position.distanceTo(this.finish.position)<0.2){
                this.nextLevel();
            }

            if (this.ball.position.y < -10){
                this.reset();
            }
        }

        if (this.controls && this.ball){
            this.controls.target.copy(this.ball.position);
            this.camera.position.y = this.ball.position.y + 4;
            this.controls.update();
        }

        this.spinStuff( dt );

        //if (this.tween) this.tween.update(dt);
        this.renderer.render( this.scene, this.camera );  
    }

    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }
}