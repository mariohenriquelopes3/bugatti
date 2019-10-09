// NECESSARIO IMPORTAR o ammo.js externamente
import * as THREE from '../build/three.module.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';

function Carro(fisica, sceneP, cameraP, nomeP) {
	var instancia = this;
	this.fisica = fisica;
	var nome = nomeP;
	var scene = sceneP;
	var camera = cameraP;
	var renderCarro;
	var sound;
	var carregouModelo = false;
	var gearRatio = [20, 100];

	// variaveis camera
	var firstPerson = false;
	var margem_up = {
		margem_1pessoa_up: 0.28,
		margem_3pessoa_up: 2
	};

	// variaveis carro
	var vehicle;
	var chassisRigidBody;
	var chassisMesh;
	var materialPneu;
	var materialRoda;	
	var FRONT_LEFT = 0;
	var FRONT_RIGHT = 1;
	var BACK_LEFT = 2;
	var BACK_RIGHT = 3;
	var wheelMeshes = [];

	// Var FBX
	var corpo;
	var trasesq;
 	var trasdir;
 	var frenteesq;
 	var frentedir;

 	// Objects Fake Rodas
 	var object3DFrenteEsq;
 	var object3DFrenteDir;

 	var object3DTrasEsq;
 	var object3DTrasDir;

 	// - Global variables -
	var DISABLE_DEACTIVATION = 4;
	var TRANSFORM_AUX = new Ammo.btTransform();
	var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);
	var materialInteractive=new THREE.MeshPhongMaterial( { color:0x990000 } );

	// Keybord actions
	var actions = {};
	var keysActions = {
		"KeyW":'acceleration',
		"ArrowUp":'acceleration',
		"KeyS":'braking',
		"ArrowDown":'braking',
		"KeyA":'left',
		"ArrowLeft":'left',
		"KeyD":'right',
		"ArrowRight":'right'
	};

	var keyup = function(e) {
		if(keysActions[e.code]) {
			actions[keysActions[e.code]] = false;
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
		if (e.code == 'KeyX') {
			firstPerson = !firstPerson;
		} else if (e.code == 'KeyZ') {
			var tm = vehicle.getChassisWorldTransform();
			chassisRigidBody.setLinearVelocity( new Ammo.btVector3( 0, 0, 0 ) );
			tm.setOrigin(new Ammo.btVector3(-0.00010793397814268246, 1.550489604473114, -19.913904190063477));
			tm.setRotation(new Ammo.btQuaternion(-0.0026274363044649363, -0.002687657019123435, -0.000005663222964358283, 0.9999929070472717));
		}
	};
	var keydown = function(e) {
		if (sound == undefined) {
			var listener = new THREE.AudioListener();
			sound = new THREE.Audio( listener );
			var audioLoader = new THREE.AudioLoader();
			audioLoader.load( 'CarEngine.wav', function( buffer ) {
				sound.setBuffer( buffer );
				sound.setLoop( true );
				sound.setVolume(0.5);
				sound.play();
			});
		}
		if(keysActions[e.code]) {
			actions[keysActions[e.code]] = true;
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	}

	var createWheelMesh = function(radius, width) {
		if (!materialPneu) {
			materialPneu = new THREE.MeshBasicMaterial({color: 0x000000});
		}
		if (!materialRoda) {
			materialRoda = new THREE.MeshBasicMaterial({color: 0x9c9898});
		}
		var t = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
		t.rotateZ(Math.PI / 2);
		var mesh = new THREE.Mesh(t, materialPneu);
		mesh.add(new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, radius * 1.75, radius*.25, 1, 1, 1), materialRoda));
		scene.add(mesh);
		return mesh;
	};

	var createChassisMesh = function(w, l, h) {
		var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
		var mesh = new THREE.Mesh(shape, materialInteractive);
		scene.add(mesh);
		return mesh;
	};

	var createVehicle = function(pos, quat) {

		// Vehicle contants

		var chassisWidth = 1.8;
		var chassisHeight = .6; // .6
		var chassisLength = 4;
		var massVehicle = 800;

		var wheelAxisPositionBack = -1;
		var wheelHalfTrackBack = 1;
		var wheelAxisHeightBack = .3;
		var wheelRadiusBack = .4;
		var wheelWidthBack = .3;

		var wheelAxisFrontPosition = 1.7;
		var wheelHalfTrackFront = 1;
		var wheelAxisHeightFront = .3;
		var wheelRadiusFront = .35;
		var wheelWidthFront = .2;

		var friction = 1000;
		var suspensionStiffness = 20.0; // KIKE
		var suspensionDamping = 2.3; // Rapidez da maciez na queda
		var suspensionCompression = 4.4; // trepidação
		var suspensionRestLength = 0.6;
		var rollInfluence = 0;

		var steeringIncrement = .04;
		var steeringClamp = .5;
		var maxEngineForce = 2000;
		var maxBreakingForce = 100;

		// Chassis
		var geometry = new Ammo.btBoxShape(new Ammo.btVector3(chassisWidth * .5, chassisHeight * .5, chassisLength * .5));
		var transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
		var motionState = new Ammo.btDefaultMotionState(transform);
		var localInertia = new Ammo.btVector3(0, 0, 0);
		geometry.calculateLocalInertia(massVehicle, localInertia);
		var body = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(massVehicle, motionState, geometry, localInertia));
		body.setActivationState(DISABLE_DEACTIVATION);
		body.nome = nome;
		instancia.fisica.physicsWorld.addRigidBody(body);
		chassisRigidBody = body;
		chassisMesh = createChassisMesh(chassisWidth, chassisHeight, chassisLength);

		// Raycast Vehicle
		var engineForce = 0;
		var vehicleSteering = 0;
		var breakingForce = 0;
		var tuning = new Ammo.btVehicleTuning();
		var rayCaster = new Ammo.btDefaultVehicleRaycaster(instancia.fisica.physicsWorld);
		vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
		vehicle.setCoordinateSystem(0, 1, 2);
		instancia.fisica.physicsWorld.addAction(vehicle);

		// Wheels
		
		var wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
		var wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

		var addWheel = function(isFront, pos, radius, width, index) {

			var wheelInfo = vehicle.addWheel(
					pos,
					wheelDirectionCS0,
					wheelAxleCS,
					suspensionRestLength,
					radius,
					tuning,
					isFront);

			wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
			wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
			wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
			wheelInfo.set_m_frictionSlip(friction);
			wheelInfo.set_m_rollInfluence(rollInfluence);

			wheelMeshes[index] = createWheelMesh(radius, width);
		};

		addWheel(true, new Ammo.btVector3(wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_LEFT);
		addWheel(true, new Ammo.btVector3(-wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_RIGHT);
		addWheel(false, new Ammo.btVector3(-wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_LEFT);
		addWheel(false, new Ammo.btVector3(wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_RIGHT);

		// Sync keybord actions and physics and graphics
		renderCarro = function(dt) {

			var speed = vehicle.getCurrentSpeedKmHour();
			var speedAbs = Math.abs(speed);
			var speedAbs2 = speedAbs;
			if (speedAbs2 >= gearRatio[gearRatio.length - 1] ) {
				speedAbs2 = gearRatio[gearRatio.length - 1] - 1;
			}
			var ii;
			for (ii = 0; ii < gearRatio.length; ii++) {
				if (gearRatio[ii] > speedAbs2) {
					break;
				}
			}
			var gearMinValue=0;
			if (ii != 0) {
				gearMinValue = gearRatio[ii - 1];
			}
			var gearMaxValue = gearRatio[ii];
			var enginePitch = ( ( speedAbs2 - gearMinValue ) * (ii+.9)  / (gearMaxValue - gearMinValue));
			enginePitch++;

			if (sound != undefined) {
				sound.setPlaybackRate(enginePitch);
			}

			// speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';
			document.querySelector('.divSpeed').innerHTML = (speed < 0 ? '(R) ' : '') + speedAbs.toFixed(1) + ' Km/h';

			breakingForce = 0;
			engineForce = 0;

			if (actions.acceleration) {
				if (speed < -1)
					breakingForce = maxBreakingForce;
				else engineForce = maxEngineForce;
			}
			if (actions.braking) {
				if (speed > 1)
					breakingForce = maxBreakingForce;
				else engineForce = -maxEngineForce / 2;
			}
			if (actions.left) {
				if (vehicleSteering < steeringClamp)
					vehicleSteering += steeringIncrement;
			}
			else {
				if (actions.right) {
					if (vehicleSteering > -steeringClamp)
						vehicleSteering -= steeringIncrement;
				}
				else {
					if (vehicleSteering < -steeringIncrement)
						vehicleSteering += steeringIncrement;
					else {
						if (vehicleSteering > steeringIncrement)
							vehicleSteering -= steeringIncrement;
						else {
							vehicleSteering = 0;
						}
					}
				}
			}

			vehicle.applyEngineForce(engineForce, BACK_LEFT);
			vehicle.applyEngineForce(engineForce, BACK_RIGHT);

			vehicle.setBrake(breakingForce / 2, FRONT_LEFT);
			vehicle.setBrake(breakingForce / 2, FRONT_RIGHT);
			vehicle.setBrake(breakingForce, BACK_LEFT);
			vehicle.setBrake(breakingForce, BACK_RIGHT);

			vehicle.setSteeringValue(vehicleSteering, FRONT_LEFT);
			vehicle.setSteeringValue(vehicleSteering, FRONT_RIGHT);

			var tm, p, q, i;
			var n = vehicle.getNumWheels();
			for (i = 0; i < n; i++) {
				vehicle.updateWheelTransform(i, true);
				tm = vehicle.getWheelTransformWS(i);
				p = tm.getOrigin();
				q = tm.getRotation();
				wheelMeshes[i].position.set(p.x(), p.y(), p.z());
				wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
			}

			tm = vehicle.getChassisWorldTransform();
			p = tm.getOrigin();
			q = tm.getRotation();
			chassisMesh.position.set(p.x(), p.y(), p.z());
			chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
		}
	};

	createVehicle(new THREE.Vector3(0, 4, -20), ZERO_QUATERNION);

	var loader = new FBXLoader();
		 loader.load('bugatti.fbx', function ( object ) {
		 	
		 	corpo = object.getObjectByName('corpo');
		 	corpo.geometry.translate(0, -.4, .36);
		 	
		 	trasesq = object.getObjectByName('trasesq');
		 	trasdir = object.getObjectByName('trasdir');
		 	frenteesq = trasdir.clone();
		 	frentedir = trasesq.clone();

		 	object.add(frenteesq);
		 	object.add(frentedir);
		 	
		 	scene.add(object);

		 	object3DFrenteEsq = new THREE.Object3D();
		 	object3DFrenteDir = new THREE.Object3D();
		 	object3DTrasEsq = new THREE.Object3D();
		 	object3DTrasDir = new THREE.Object3D();

		 	carregouModelo = true;
	 }, function(xhr) {
	 	document.querySelector('.divLoading').innerHTML = ( xhr.loaded / xhr.total * 100 ).toFixed(2) + '% Loading bugatti';
	 	if (xhr.loaded == xhr.total) {
	 		document.querySelector('.divLoading').style.display = 'none';
	 	}
	 });

	 this.render = function (dt) {

	 	if (renderCarro) {
	 		renderCarro(dt);
	 	}

		chassisMesh.visible = false;
		wheelMeshes[FRONT_LEFT].visible = false;
		wheelMeshes[FRONT_RIGHT].visible = false;
		wheelMeshes[BACK_LEFT].visible = false;
		wheelMeshes[BACK_RIGHT].visible = false;

		if (firstPerson) {
			if (camera) {
				camera.position.copy(chassisMesh.position);
				camera.quaternion.copy(chassisMesh.quaternion);
				camera.rotateY(Math.PI);
				camera.translateY(margem_up.margem_1pessoa_up);
			}

			if (carregouModelo) {
				corpo.visible = false;
			 	trasesq.visible = false;
			 	trasdir.visible = false;
			 	frenteesq.visible = false;
			 	frentedir.visible = false;
			}
		} else {
			if (camera) {
				
				var deslocX = (chassisMesh.position.x - camera.position.x) * .2 * dt;
				var deslocY = (chassisMesh.position.y - camera.position.y) * .2 * dt;
				var deslocZ = (chassisMesh.position.z - camera.position.z) * .2 * dt;

				camera.position.x += deslocX;
				camera.position.y  = chassisMesh.position.y;
				camera.position.z += deslocZ;

				camera.lookAt(chassisMesh.position);
				var d = Math.abs(camera.position.distanceTo( chassisMesh.position ));
				if (d > 4.60) {
					camera.translateZ(-1 * (d-4.60) );
				}
				//camera.position.y += margem_up.margem_3pessoa_up;
				camera.translateY(margem_up.margem_3pessoa_up);
				camera.lookAt(chassisMesh.position);

				// DEBUG CAM
				//camera.position.copy(chassisMesh.position);
				//camera.position.x += 5;
				//camera.lookAt(chassisMesh.position);
			}

			/*********/
			// FBX OBJ
			if (carregouModelo) {
				trasesq.position.copy(wheelMeshes[BACK_LEFT].position);
				trasesq.quaternion.copy(wheelMeshes[BACK_LEFT].quaternion);

				object3DTrasEsq.position.copy(chassisMesh.position);
				object3DTrasEsq.quaternion.copy(chassisMesh.quaternion);
				object3DTrasEsq.translateX(-.9);
				object3DTrasEsq.translateZ(-1.235);
				object3DTrasEsq.translateY(-.18);

				// trasdir
				trasdir.position.copy(wheelMeshes[BACK_RIGHT].position);
				trasdir.quaternion.copy(wheelMeshes[BACK_RIGHT].quaternion);

				object3DTrasDir.position.copy(chassisMesh.position);
				object3DTrasDir.quaternion.copy(chassisMesh.quaternion);
				object3DTrasDir.translateX(.9);
				object3DTrasDir.translateZ(-1.235);
				object3DTrasDir.translateY(-.18);

				// frenteesq
				frenteesq.position.copy(wheelMeshes[FRONT_LEFT].position);
				frenteesq.quaternion.copy(wheelMeshes[FRONT_LEFT].quaternion);

				object3DFrenteEsq.position.copy(chassisMesh.position);
				object3DFrenteEsq.quaternion.copy(chassisMesh.quaternion);
				object3DFrenteEsq.translateX(.9);
				object3DFrenteEsq.translateZ(1.15);
				object3DFrenteEsq.translateY(-.2);

				// frentedir
				frentedir.position.copy(wheelMeshes[FRONT_RIGHT].position);
				frentedir.quaternion.copy(wheelMeshes[FRONT_RIGHT].quaternion);

				object3DFrenteDir.position.copy(chassisMesh.position);
				object3DFrenteDir.quaternion.copy(chassisMesh.quaternion);
				object3DFrenteDir.translateX(-.9);
				object3DFrenteDir.translateZ(1.15);
				object3DFrenteDir.translateY(-.2);

				// corpo
				corpo.position.copy(chassisMesh.position);
				corpo.quaternion.copy(chassisMesh.quaternion);

				frenteesq.position.x = object3DFrenteEsq.position.x;
				frenteesq.position.y = object3DFrenteEsq.position.y;
				frenteesq.position.z = object3DFrenteEsq.position.z;

				frentedir.position.x = object3DFrenteDir.position.x;
				frentedir.position.y = object3DFrenteDir.position.y;
				frentedir.position.z = object3DFrenteDir.position.z;

				trasdir.position.x = object3DTrasDir.position.x;
				trasdir.position.y = object3DTrasDir.position.y;
				trasdir.position.z = object3DTrasDir.position.z;

				trasesq.position.x = object3DTrasEsq.position.x;
				trasesq.position.y = object3DTrasEsq.position.y;
				trasesq.position.z = object3DTrasEsq.position.z;

				corpo.visible = true;
			 	trasesq.visible = true;
			 	trasdir.visible = true;
			 	frenteesq.visible = true;
			 	frentedir.visible = true;
			}
		}
		/**************/
	 };

	 if (camera) {
	 	window.addEventListener( 'keydown', keydown );
	 	window.addEventListener( 'keyup', keyup );
	 }

	 this.getBody = function () {
	 	return chassisRigidBody;
	 }

	 this.getVehicle = function () {
	 	return vehicle;
	 }

}

export { Carro };