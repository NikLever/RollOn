import {
    Clock, Raycaster, Vector3, Scene, Color, PerspectiveCamera, HemisphereLight, DirectionalLight,
    WebGLRenderer, Vector2, Group, Mesh, SphereGeometry, PMREMGenerator, CubeTextureLoader, MeshBasicMaterial
} from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
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
        this.input = new Vector3();

        this.score = 0;
        this.levelIndex = 0;

        this.stepPhysics = false;

        if ( localStorage ){
            if (false){
                localStorage.setItem("score", 0);
                localStorage.setItem("levelIndex", 0);
            }

            const score = Number(localStorage.getItem( "score" ));
            const levelIndex = Number(localStorage.getItem("levelIndex"));

            if (score != null) this.score = score;
            if (levelIndex != null) this.levelIndex = levelIndex;
        }

        this.joystick = new JoyStick({ onMove: (x, z) => {
            this.input.x = x;
            this.input.z = -z;
        } })
        //this.loadSounds();

        const scope = this;

        function onMove(x, z){
            scope.input.x = x;
            scope.input.z = z;
        }

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
        light.position.set( 0.2, 1, 1 );
        this.scene.add(light);

        this.renderer = new WebGLRenderer({antialias: true});
        this.renderer.setPixelRatio( Math.max(window.devicePixelRatio, 2) );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        document.body.appendChild( this.renderer.domElement );
            
        const controls = new OrbitControls( this.camera, this.renderer.domElement );
        controls.target.y = 0.0;
        controls.update();
        controls.enablePan = controls.enableZoom = false;
        this.controls = controls;
            
        window.addEventListener( 'resize', this.resize.bind(this), false);

        this.setEnvironment();

        this.loadSkybox();
            
        this.loadBits();

        this.loadLevel(1);
    }

    nextLevel(){
        this.stepPhysics = false;
        this.levelIndex++;
        this.loadLevel(this.levelIndex);
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
        this.physics.addMesh(this.ball, 1);
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
                                console.log(`Game.loadBits ${child.name}`);
                                break;
                        }
                    }else{
                        this.bits[child.name] = child;
                        console.log(`Game.loadBits ${child.name}`);
                    }

                    this.scene.add(this.ball);
                });

                this.initPhysics();

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
                mesh.geometry.dispose();
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            this.scene.remove(mesh);
        })
    }

    loadLevel(index){
        if ( this.level ) this.clearLevel();

        const loader = new GLTFLoader( );
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
                let obj;
                gltf.scene.traverse( child => { 
                    obj = child;
                    if (child && child.name){
                        console.log(`Game.loadLevel ${child.name}`)
                        switch(child.name){
                        case "Collider":
                            child.visible = false;
                            this.collider = child;
                            this.level.push(child);
                            break;
                        case "start":
                            this.ball.position.copy(child.position);
                            break;
                        case "finish":
                            this.finish = child;
                            break;
                        case "Level":
                            this.level.push(child);
                            break;
                        }
                        if (child.name.startsWith("Box")){
                            const pickup = this.bits[child.name].clone();
                            pickup.position.copy(child.position);
                            //this.scene.add(pickup);
                            this.level.push(pickup);
                            pickup.userData.noDispose = true;
                        }
                    }
                });

                this.level.forEach( mesh => {
                    this.scene.add(mesh);
                })
                

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

    update(){
        requestAnimationFrame( this.update.bind(this) );
        
        const dt = this.clock.getDelta();

        if (this.stepPhysics){
            if (this.input.x!=0 || this.input.z!=0){
                this.camera.getWorldDirection(this.tmpVec3).multiply(this.input).multiplyScalar(0.1);
                //this.tmpVec3.set( this.input.x, 0, this.input.y ).multiplyScalar(0.1);
                this.physics.applyImpulse( this.ball, this.tmpVec3 )
            }
            this.physics.step();
        }

        if (this.controls && this.ball){
            this.controls.target.copy(this.ball.position)
            this.controls.update();
        }
        //if (this.tween) this.tween.update(dt);
        this.renderer.render( this.scene, this.camera );  
    }

    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }
}