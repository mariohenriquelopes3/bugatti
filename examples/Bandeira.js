import * as THREE from '../build/three.module.js';

function Bandeira(sceneP) {

	var scene = sceneP;
    
    var params = {
        enableWind: true,
        showBall: false
        
    };

    var windStrength = 80;

    var DAMPING = 0.8;
    var DRAG = 1 - DAMPING;
    var MASS = 0.1;
    var restDistance = 25;

    var xSegs = 10;
    var ySegs = 10;

    var clothFunction = plane(restDistance * xSegs, restDistance * ySegs);

    var cloth = new Cloth(xSegs, ySegs);

    var GRAVITY = 981 * 1.4;
    var gravity = new THREE.Vector3(0, -GRAVITY, 0).multiplyScalar(MASS);

    var TIMESTEP = 18 / 1000;
    var TIMESTEP_SQ = TIMESTEP * TIMESTEP;

    var windForce = new THREE.Vector3(0, 0, 0);

    var ballPosition = new THREE.Vector3(0, -45, 0);
    var ballSize = 60; //40

    var tmpForce = new THREE.Vector3();

    var lastTime;


    function plane(width, height) {
        return function(u, v, target) {
            var x = (u - 0.5) * width;
            var y = (v + 0.5) * height;
            var z = 0;
            target.set(x, y, z);
        };
    }

    function Particle(x, y, z, mass) {
        this.position = new THREE.Vector3();
        this.previous = new THREE.Vector3();
        this.original = new THREE.Vector3();
        this.a = new THREE.Vector3(0, 0, 0); // acceleration
        this.mass = mass;
        this.invMass = 1 / mass;
        this.tmp = new THREE.Vector3();
        this.tmp2 = new THREE.Vector3();

        // init
        clothFunction(x, y, this.position); // position
        clothFunction(x, y, this.previous); // previous
        clothFunction(x, y, this.original);
    }

    // Force -> Acceleration
    Particle.prototype.addForce = function(force) {
        this.a.add(
            this.tmp2.copy(force).multiplyScalar(this.invMass)
        );
    };


    // Performs Verlet integration
    Particle.prototype.integrate = function(timesq) {
        var newPos = this.tmp.subVectors(this.position, this.previous);
        newPos.multiplyScalar(DRAG).add(this.position);
        newPos.add(this.a.multiplyScalar(timesq));

        this.tmp = this.previous;
        this.previous = this.position;
        this.position = newPos;

        this.a.set(0, 0, 0);
    };


    var diff = new THREE.Vector3();

    function satisfyConstraints(p1, p2, distance) {
        diff.subVectors(p2.position, p1.position);
        var currentDist = diff.length();
        if (currentDist === 0) return; // prevents division by 0
        var correction = diff.multiplyScalar(1 - distance / currentDist);
        var correctionHalf = correction.multiplyScalar(0.5);
        p1.position.add(correctionHalf);
        p2.position.sub(correctionHalf);
    }


    function Cloth(w, h) {
        w = w || 10;
        h = h || 10;
        this.w = w;
        this.h = h;

        var particles = [];
        var constraints = [];
        var arrMinX = [];
        var arrMaxY = [];

        var u, v;

        // Create particles
        for (v = 0; v <= h; v++) {
            for (u = 0; u <= w; u++) {
                particles.push(
                    new Particle(u / w, v / h, 0, MASS)
                );
            }
        }

        // Structural

        for (v = 0; v < h; v++) {
            for (u = 0; u < w; u++) {
                constraints.push([
                    particles[index(u, v)],
                    particles[index(u, v + 1)],
                    restDistance
                ]);
                constraints.push([
                    particles[index(u, v)],
                    particles[index(u + 1, v)],
                    restDistance
                ]);
            }
        }

        for (u = w, v = 0; v < h; v++) {
            constraints.push([
                particles[index(u, v)],
                particles[index(u, v + 1)],
                restDistance

            ]);
        }

        for (v = h, u = 0; u < w; u++) {
            constraints.push([
                particles[index(u, v)],
                particles[index(u + 1, v)],
                restDistance
            ]);
        }

        this.particles = particles;
        this.constraints = constraints;

        function index(u, v) {
            return u + v * (w + 1);
        }

        this.index = index;

        var menorX = undefined;
        var maxY = undefined;

        for (var i = 0; i < particles.length; i++) {
        	if (menorX == undefined || particles[i].original.x < menorX) {
        		menorX = particles[i].original.x;
        	}
        	if (maxY == undefined || particles[i].original.y > maxY) {
        		maxY = particles[i].original.y;
        	}
        }
        for (var i = 0; i < particles.length; i++) {
        	if (particles[i].original.x == menorX) {
        		arrMinX.push( i );
        	}
        }
        for (var i = 0; i < particles.length; i++) {
        	if (particles[i].original.y == maxY) {
        		arrMaxY.push( i );
        	}
        }

        this.fixar = function () {
        	var p;
        	for (var i = 0; i < arrMinX.length; i++) {
        		p = particles[ arrMinX[i] ];
        		p.position.copy(p.original);
        		p.previous.copy(p.original);
        	}
        	// for (var i = 0; i < arrMaxY.length; i++) {
        	// 	p = particles[ arrMaxY[i] ];
        	// 	p.position.copy(p.original);
        	// 	p.previous.copy(p.original);
        	// }
        }

    }

    function simulate(time) {
        if (!lastTime) {
            lastTime = time;
            return;
        }

        var i, j, il, particles, particle, constraints, constraint;

        // Aerodynamics forces

        if (params.enableWind) {

            var indx;
            var normal = new THREE.Vector3();
            var indices = clothGeometry.index;
            var normals = clothGeometry.attributes.normal;

            particles = cloth.particles;

            for (i = 0, il = indices.count; i < il; i += 3) {

                for (j = 0; j < 3; j++) {

                    indx = indices.getX(i + j);
                    normal.fromBufferAttribute(normals, indx);
                    tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce));
                    particles[indx].addForce(tmpForce);

                }

            }

        }

        for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

            particle = particles[i];
            particle.addForce(gravity);

            particle.integrate(TIMESTEP_SQ);

        }

        // Start Constraints

        constraints = cloth.constraints;
        il = constraints.length;

        for (i = 0; i < il; i++) {

            constraint = constraints[i];
            satisfyConstraints(constraint[0], constraint[1], constraint[2]);

        }

        // Ball Constraints

        ballPosition.z = -Math.sin(Date.now() / 600) * 90; //+ 40;
        ballPosition.x = Math.cos(Date.now() / 400) * 70;

        if (params.showBall) {

            sphere.visible = true;

            for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

                particle = particles[i];
                var pos = particle.position;
                diff.subVectors(pos, ballPosition);
                if (diff.length() < ballSize) {

                    // collided
                    diff.normalize().multiplyScalar(ballSize);
                    pos.copy(ballPosition).add(diff);

                }

            }

        } else {

            sphere.visible = false;

        }


        // Floor Constraints

        /*
        for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

            particle = particles[i];
            pos = particle.position;
            if (pos.y < -250) {

                pos.y = -250;

            }

        }
        */

        // Pin Constraints

        /*
        for (i = 0, il = pins.length; i < il; i++) {

            var xy = pins[i];
            var p = particles[xy];
            p.position.copy(p.original);
            p.previous.copy(p.original);

        }
        */

        cloth.fixar();

    }

    /* testing cloth simulation */

    var clothGeometry;
    var sphere;
    var object;

    init();

    function init() {
        // cloth material

        var loader = new THREE.TextureLoader();
        var clothTexture = loader.load('bandeira.jpg');
        clothTexture.anisotropy = 16;

        var clothMaterial = new THREE.MeshLambertMaterial({
            map: clothTexture,
            side: THREE.DoubleSide,
            alphaTest: 0.5
        });

        // cloth geometry

        clothGeometry = new THREE.ParametricBufferGeometry(clothFunction, cloth.w, cloth.h);

        // cloth mesh

        object = new THREE.Mesh(clothGeometry, clothMaterial);
        object.position.set(0, 0, 0);
        object.castShadow = true;
        scene.add(object);

        object.customDepthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            map: clothTexture,
            alphaTest: 0.5
        });

        // sphere

        var ballGeo = new THREE.SphereBufferGeometry(ballSize, 32, 16);
        var ballMaterial = new THREE.MeshLambertMaterial();

        sphere = new THREE.Mesh(ballGeo, ballMaterial);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        sphere.visible = false;
        scene.add(sphere);
    
    }

    this.animate = function () {
        
        var time = Date.now();

        // windStrength = Math.cos(time / 7000) * 20 + 40;
        // windForce.set(Math.sin(time / 2000), Math.cos(time / 3000), Math.sin(time / 1000));

        windForce.set(0, 0, -1);
        windForce.normalize();
        windForce.multiplyScalar(windStrength);

        simulate(time);
        render();
    };

    function render() {

        var p = cloth.particles;

        for (var i = 0, il = p.length; i < il; i++) {

            var v = p[i].position;

            clothGeometry.attributes.position.setXYZ(i, v.x, v.y, v.z);

        }

        clothGeometry.attributes.position.needsUpdate = true;

        clothGeometry.computeVertexNormals();

        sphere.position.copy(ballPosition);

    }

    this.getScene = function () {
        return scene;
    };

    this.setWindStrength = function (value) {
        windStrength = value;
    };
    this.setDRAG = function (value) {
    	DRAG = value;
    };

}

export { Bandeira };