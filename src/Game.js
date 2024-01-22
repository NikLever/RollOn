import {
    Clock, Raycaster, Vector3, Scene, Color, PerspectiveCamera, HemisphereLight, DirectionalLight,
    WebGLRenderer, Vector2, Group, Mesh, SphereGeometry, PMREMGenerator, CubeTextureLoader, MeshBasicMaterial
} from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { Physics } from "./Physics"
import { Tween } from "./Toon3D"
import { SFX } from "./SFX"
import { UI } from "./UI"

export class Game{
    constructor(){
        this.init();

        this.clock = new Clock();

        //this.raycaster = new Raycaster();

        this.modes = Object.freeze({
			NONE:   0,
			PRELOAD: 1,
			INITIALISING:  2,
			CREATING_LEVEL: 3,
			ACTIVE: 4,
			IN_CUP: 5,
			GAMEOVER: 6
		});

        this.tmpVec3 = new Vector3();

        this.cellSize = 1.6;

        this.score = 0;
        this.levelIndex = 0;

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

       // this.levelIndex = 11;

        //this._hints = this.hints;

        //this.loadSounds();

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
        this.camera.position.set(0, 0.5, 6);

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
        this.controls = controls;
            
        window.addEventListener( 'resize', this.resize.bind(this), false);

        this.setEnvironment();

        this.loadSkybox();
            
        this.loadBits();

        this.loadLevel(1);
    }

    nextLevel(){
        this.stepPhysics = false;
    }

    async initPhysics(){
        this.physics = new Physics();
        await this.physics.initPhysics();

        //this.ui = new UI(this);

        //this.ui.score = this.score; 
        
        //this.initLevel(this.levelIndex);

        this.update();
    }

    initLevel(index){
        if (this.level){
            this.scene.remove(this.level);
            this.physics.reset();
        }
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
        //this.physics.addMesh(this.bits.ball, 6);
        //this.physics.addMesh(this.bits.cup);
        //this.physics.setCollisionEventsActive(this.bits.cup);
        //this.physics.setCollisionEventsActive(this.bits.ball);

        //this.level.children.forEach( pipe => {
        //    this.physics.addMesh(pipe);
        //})
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
                                console.log(`Game.loadBits ${child.name}`);
                                break;
                        }
                    }else{
                        this.bits[child.name] = child;
                        console.log(`Game.loadBits ${child.name}`);
                    }
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

    loadLevel(index){
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
                    
                gltf.scene.traverse( child => {
                    if (child){
                        console.log(`Game.loadLevel ${child.name}`)
                        switch(child.name){
                        case "Collider":
                            child.visible = false;
                            this.collider = child;
                            break;
                        case "start":
                            //this.ball.position.copy(child.position);
                            break;
                        }
                    }
                });

                this.scene.add(gltf.scene);

                this.initLevelPhysics();
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
            this.physics.step();
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