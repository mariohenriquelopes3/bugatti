// NECESSARIO IMPORTAR o ammo.js externamente
import * as THREE from '../build/three.module.js';

function Fisica(objetos, funcaoColisao, gravityConstant, funcaoLoad) {
	var instancia = this;

	this.objetos = objetos;
	this.funcaoColisao = funcaoColisao;
	this.funcaoLoad = funcaoLoad;

	this.rigidBodies = [];
	this.gravityConstant = gravityConstant;
	if (this.gravityConstant == undefined) {
		this.gravityConstant = 7.8;
	}
	this.collisionConfiguration;
	this.dispatcher;
	this.broadphase;
	this.solver;
	this.physicsWorld;
	this.margin = 0.05;
	this.transformAux1;
	this.tempBtVec3_1;
	this.loaded = false;

	this.createObject = function (obj) {
		var massa = obj.massa;
		var friccao = obj.friccao;
		var convexo = obj.convexo;
		var margin = obj.margin;
		if (massa == undefined) {
			massa = 0;
		}
		if (friccao == undefined) {
			friccao = 0.5;
		}
		if (convexo == undefined) {
			convexo = true;
		}
		if (margin == undefined) {
			margin = this.margin;
		}
		var shape;
		if (convexo) {
			shape = this.createConvexHullPhysicsShape(obj, new Ammo.btConvexHullShape());
			shape.setMargin(margin);
		} else {
			var mesh = this.createTriangleShapeByGeometry(obj, new Ammo.btTriangleMesh(true, true));
			shape = new Ammo.btBvhTriangleMeshShape(mesh, true, true);
			shape.setMargin(margin);
		}
		
		var transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin( new Ammo.btVector3( obj.position.x, obj.position.y, obj.position.z ) );
		transform.setRotation( new Ammo.btQuaternion( obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w ) );
		var motionState = new Ammo.btDefaultMotionState( transform );
		var localInertia = new Ammo.btVector3( 0, 0, 0 );
		shape.calculateLocalInertia( massa, localInertia );
		var rbInfo = new Ammo.btRigidBodyConstructionInfo( massa, motionState, shape, localInertia );
		var body = new Ammo.btRigidBody( rbInfo );
		body.setFriction( friccao );
		obj.userData.physicsBody = body;
		body.objeto = obj; // Objeto threejs
		if (massa > 0) {
			this.rigidBodies.push(obj);
			// Disable deactivation
			body.setActivationState( 4 );
		}
		this.physicsWorld.addRigidBody(body);

		var btVecUserData = new Ammo.btVector3( 0, 0, 0 );
		btVecUserData.threeObject = obj;
		body.setUserPointer( btVecUserData );
		
	};

	this.createTriangleShapeByGeometry = function(obj, mesh) {

		if (obj.children && obj.children.length > 0) {
			for (var i = 0; i < obj.children.length; i++) {
				this.createTriangleShapeByGeometry(obj.children[i], mesh);
			}
			return mesh;
		}

		var geometry = obj.geometry;

		if (geometry.isBufferGeometry) {
			geometry = new THREE.Geometry().fromBufferGeometry(geometry);
		}

		var vertices = geometry.vertices;
		for (var i = 0; i < geometry.faces.length; i++) {
			var face = geometry.faces[i];
			mesh.addTriangle(
				new Ammo.btVector3(vertices[face.a].x, vertices[face.a].y, vertices[face.a].z),
				new Ammo.btVector3(vertices[face.b].x, vertices[face.b].y, vertices[face.b].z),
				new Ammo.btVector3(vertices[face.c].x, vertices[face.c].y, vertices[face.c].z),
				false
			);
		}
		return mesh;
	};

	this.createConvexHullPhysicsShape = function(obj, shape) {
		if (obj.children && obj.children.length > 0) {
			for (var i = 0; i < obj.children.length; i++) {
				this.createConvexHullPhysicsShape(obj.children[i], shape);
			}
			return shape;
		}
		
		var coords = obj.geometry.attributes.position.array;
		for ( var i = 0, il = coords.length; i < il; i += 3 ) {
			this.tempBtVec3_1.setValue( coords[ i ], coords[ i + 1 ], coords[ i + 2 ] );
			var lastOne = ( i >= ( il - 3 ) );
			shape.addPoint( this.tempBtVec3_1, lastOne );
		}
		return shape;
	};

	this.render = function(deltaTime) {
		if (!this.loaded) {
			return;
		}

		// Step world
		this.physicsWorld.stepSimulation( deltaTime, 10 );

		// Update rigid bodies
		for ( var i = 0, il = this.rigidBodies.length; i < il; i ++ ) {
			var objThree = this.rigidBodies[ i ];
			var objPhys = objThree.userData.physicsBody;
			var ms = objPhys.getMotionState();

			if (ms) {
				ms.getWorldTransform( this.transformAux1 );
				var p = this.transformAux1.getOrigin();
				var q = this.transformAux1.getRotation();
				objThree.position.set( p.x(), p.y(), p.z() );
				objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
			}
		}

		for (var i = 0, il = this.dispatcher.getNumManifolds(); i < il; i ++) {
			var contactManifold = this.dispatcher.getManifoldByIndexInternal( i );
			var rb0 = Ammo.castObject( contactManifold.getBody0(), Ammo.btRigidBody );
			var rb1 = Ammo.castObject( contactManifold.getBody1(), Ammo.btRigidBody );

			var maxImpulse = 0;
			var impactPoint = new THREE.Vector3();
			var impactNormal = new THREE.Vector3();
			for ( var j = 0, jl = contactManifold.getNumContacts(); j < jl; j ++ ) {
				var contactPoint = contactManifold.getContactPoint( j );
				if ( contactPoint.getDistance() < 0 ) {
					var impulse = contactPoint.getAppliedImpulse();
					if ( impulse > maxImpulse ) {
						maxImpulse = impulse;
						var pos = contactPoint.get_m_positionWorldOnB();
						var normal = contactPoint.get_m_normalWorldOnB();
						impactPoint.set( pos.x(), pos.y(), pos.z() );
						impactNormal.set( normal.x(), normal.y(), normal.z() );
					}
					break;
				}
			}

			if (this.funcaoColisao != undefined) {
				this.funcaoColisao(rb0, rb1, maxImpulse, impactPoint, impactNormal);
			}
		}
	};

	Ammo().then(function(AmmoLib) {
		Ammo = AmmoLib;

		// Init
		instancia.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
		instancia.dispatcher = new Ammo.btCollisionDispatcher( instancia.collisionConfiguration );
		instancia.broadphase = new Ammo.btDbvtBroadphase();
		instancia.solver = new Ammo.btSequentialImpulseConstraintSolver();
		instancia.physicsWorld = new Ammo.btDiscreteDynamicsWorld( instancia.dispatcher, instancia.broadphase, instancia.solver, instancia.collisionConfiguration );
		instancia.physicsWorld.setGravity( new Ammo.btVector3( 0, - instancia.gravityConstant, 0 ) );
		instancia.transformAux1 = new Ammo.btTransform();
		instancia.tempBtVec3_1 = new Ammo.btVector3( 0, 0, 0 );
		

		for (var i = 0; i < instancia.objetos.length; i++) {
			instancia.createObject(instancia.objetos[i]);
		}

		instancia.loaded = true;

		if (instancia.funcaoLoad != undefined) {
			instancia.funcaoLoad(instancia);
		}

	});

}

export { Fisica };