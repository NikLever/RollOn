import {
    Scene, Color, PerspectiveCamera, HemisphereLight, DirectionalLight,
    WebGLRenderer, Mesh, MeshBasicMaterial, PMREMGenerator, CubeTextureLoader,
    MeshStandardMaterial, TextureLoader, RepeatWrapping
} from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export class Converter{

    constructor(){
        this.init();

        const link = document.createElement( 'a' );
		link.style.display = 'none';
		document.body.appendChild( link );
        this.link = link;

        this.levelIndex = 13;
    }

    init(){
        this.scene = new Scene();
        this.scene.background = new Color( 0xaaaaaa );
    
        this.camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
        this.camera.position.set(0, 3.5, 6);

        const ambient = new HemisphereLight(0xffffff, 0xbbbbff, 0.1);
        this.scene.add(ambient);

        const light = new DirectionalLight(0xFFFFFF, 2);
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

        this.createMaterials();

    }

    createMaterials(){
        const filenames = [ "LevelTile1", "LevelTarget" ];

        this.materials = {};

        let count = 0;

        filenames.forEach( name => {
            const loader = new TextureLoader().setPath('../dev/textures/')
                   .load( `${name}.png`, map => {
                    this.materials[name] = new MeshStandardMaterial( { map, emissive: new Color( 0x000000 ) });
                    map.wrapS = RepeatWrapping;
                    map.wrapT = RepeatWrapping;
                    count++;
                    if (count == filenames.length) this.loadLevel(11);
                   } );
        })
    }

    nextLevel(){
        if (this.levelIndex<50){
            this.levelIndex++;
            this.loadLevel(this.levelIndex);
        }
    }

    loadSkybox(){
        this.scene.background = new CubeTextureLoader()
	        .setPath( '../Assets/skyboxes/paintedsky/' )
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

    setEnvironment(){
        const loader = new RGBELoader();
        const pmremGenerator = new PMREMGenerator( this.renderer );
        pmremGenerator.compileEquirectangularShader();

        loader.load( '../assets/venice_sunset_1k.hdr', ( texture ) => {
            const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
            pmremGenerator.dispose();

            this.scene.environment = envMap;

        }, undefined, (err)=>{
            console.error( 'An error occurred setting the environment.' + err.message );
        } );
    }

    clearLevel(){

        this.level.traverse( child => {
            if (child.isMesh){
                if (child.geometry) child.geometry.dispose();
                if (child.material){
                    if (child.material.constructor === Array){
                        child.material.forEach( material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        })
                    }else{
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        })

        this.scene.remove( this.level );

    }

    loadLevel(index){
        if ( this.level ) this.clearLevel();

        this.levelIndex = index;

        const loader = new FBXLoader().setPath('../dev/');

        const name = (index<10) ? `Level0${index}` : `Level${index}`;
        console.log(`loadLevel(${index})`);

        // Load a FBX resource
        loader.load(
            // resource URL
            `${name}.fbx`,
            // called when the resource is loaded
            object => {
                let colliders = [];
                const black = new Color( 0x000000 );

                object.traverse( child => { 
                    child.scale.set( 1.0, 1.0, 1.0 );
                    if (this.levelIndex>=5) child.position.multiplyScalar( 0.01 );
                    if (child.isMesh){
                        if (this.levelIndex>=5) child.geometry.scale( 0.01, 0.01, 0.01 );
                        if (child.material.constructor === Array){
                            for( let i=0; i<child.material.length; i++){
                                let mat = new MeshStandardMaterial( );
                                let material = child.material[i];
                                mat.color = material.color;
                                if (material.name == 'Edges'){
                                    mat.emissive = material.color;
                                }else if (material.map){
                                    const dot = material.map.name.lastIndexOf( '.' );
                                    const slash = material.map.name.lastIndexOf( '/' );
                                    const name = material.map.name.substring( slash+1, dot );
                                    console.log( `Material map name: ${name}` );
                                    mat = this.materials[name];
                                }
                                child.material[i] = mat; 
                            }
                        }else{
                            let mat = new MeshStandardMaterial( );
                            if (child.material.map){
                                const dot = child.material.map.name.lastIndexOf( '.' );
                                const slash = child.material.map.name.lastIndexOf( '/' );
                                const name = child.material.map.name.substring( slash+1, dot );
                                console.log( `Material map name: ${name}` );
                                mat = this.materials[name];
                            }else{
                                mat.color = child.material.color;
                            }
                            child.material = mat;
                        }
                        if (child.name.startsWith('Level')){
                            colliders.push(child.geometry);
                        }
                    }
                });             
                
                let geometry;

                if (colliders.length>1){
                    console.log('Removing uv1');
                    colliders.forEach( collider => {
                        const attr = collider.getAttribute( 'uv1' );
                        if ( attr ) collider.deleteAttribute( 'uv1' );
                    });
                    geometry = BufferGeometryUtils.mergeGeometries( colliders );
				    geometry.computeBoundingSphere();
                }else{
                    geometry = colliders[0];
                }
                const collider = new Mesh( geometry, new MeshBasicMaterial() );
                collider.name = 'Collider';
                collider.visible = false;
                object.add( collider );

                this.level = object;

                this.scene.add(object);

                this.update();

                this.export( object, name );
            },
            // called while loading is progressing
            null,
            // called when loading has errors
            err => {

                console.error( err.message );

            }  
        );
    }

    export( object, name ){
        const gltfExporter = new GLTFExporter();

        const options = {
            trs: false,
            onlyVisible: false,
            binary: true,
            maxTextureSize: 1024
        };

        gltfExporter.parse(
            object,
            ( result ) => {

                this.save( result, `${name}.glb` );

            },
            ( error ) => {

                console.log( 'An error happened during parsing', error );

            },
            options
        );
    }

    save( buffer, filename ) {
        const blob = new Blob( [ buffer ], { type: 'application/octet-stream' } );

        this.link.href = URL.createObjectURL( blob );
        this.link.download = filename;
        this.link.click();

    }

    update(){
        requestAnimationFrame( this.update.bind(this) );
        this.renderer.render( this.scene, this.camera );  
    }

    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }
}