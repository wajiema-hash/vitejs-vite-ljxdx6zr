import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

RAPIER.init().then(() => {
    runGame();
});

function runGame() {
    // --- 1. Core Visuals & System Setup ---
    const container = document.getElementById('canvas-container');
    const promptElem = document.getElementById('interaction-prompt');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);
    scene.fog = new THREE.FogExp2(0xbfd1e5, 0.01);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Realistic Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    sunLight.position.set(30, 60, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // --- 2. Wasm Physics Initialization ---
    const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

    // Environment: Ground Plane
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.1, 200), groundBody);
    const groundMesh = new THREE.Mesh(new THREE.GridHelper(400, 400, 0x444444, 0xaaaaaa));
    groundMesh.position.y = 0.05;
    scene.add(groundMesh);

    // --- 3. First Person Character System ---
    const player = {
        body: world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.8, 5)),
        moveDirection: new THREE.Vector3(),
        rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
        speed: 0.08,
        heldObject: null,
        activeTool: 'screwdriver' // Default physical tool held
    };
    // Character dimension bounding box
    world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3), player.body);

    // Pointer Lock Controls Click handler
    window.addEventListener('click', () => {
        if (document.pointerLockElement !== container) container.requestPointerLock();
    });

    window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== container) return;
        player.rotation.y -= e.movementX * 0.0025;
        player.rotation.x -= e.movementY * 0.0025;
        player.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.rotation.x));
        camera.quaternion.setFromEuler(player.rotation);
    });

    // Input Registers
    const keys = { w: false, a: false, s: false, d: false, q: false };
    window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false; });

    // --- 4. Refined Satsuma Assembly Infrastructure ---
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Create Detailed Car Frame (Aesthetic Hatchback Proportions)
    const carBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.6, 0).setCanSleep(false);
    const carRigidBody = world.createRigidBody(carBodyDesc);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 0.4, 1.7), carRigidBody); // Main body collider

    const satsumaShell = new THREE.Group();
    // Chassis main body
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 3.2), new THREE.MeshStandardMaterial({ color: 0x992222, roughness: 0.2 }));
    mainBody.position.y = 0.2;
    satsumaShell.add(mainBody);
    // Cabin roof structure
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), new THREE.MeshStandardMaterial({ color: 0x992222, roughness: 0.2 }));
    cabin.position.set(0, 0.7, -0.3);
    satsumaShell.add(cabin);
    // Empty Engine bay cutout designator
    const engineBayIndicator = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x111111, wireframe: true }));
    engineBayIndicator.position.set(0, 0.1, 1.0);
    satsumaShell.add(engineBayIndicator);

    carGroup.add(satsumaShell);

    // --- 5. Interactive Structural Parts Library ---
    const interactableObjects = [];

    function createPart(name, size, pos, color, metadata = {}) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
        const body = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x/2, size.y/2, size.z/2);
        world.createCollider(colliderDesc, body);

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 }));
        scene.add(mesh);

        const partObj = {
            name: name,
            mesh: mesh,
            body: body,
            isAttached: false,
            tuningValues: { fuelMix: 14.7, valveTuning: 0.0, ...metadata.tuning },
            snapTarget: metadata.snapTarget || null
        };
        interactableObjects.push(partObj);
        return partObj;
    }

    // Spawn Loose components around the room
    const engineBlock = createPart("Engine Block", { x: 0.5, y: 0.4, z: 0.6 }, { x: -2, y: 1, z: 0 }, 0x555555, {
        snapTarget: { x: 0, y: 0.2, z: 1.0, type: 'engine' },
        tuning: { fuelMix: 14.7 } // Tuning capability configuration parameter
    });

    const frontLeftWheel = createPart("Front Left Wheel", { x: 0.3, y: 0.6, z: 0.6 }, { x: 2, y: 1, z: 1 }, 0x222222, {
        snapTarget: { x: -0.9, y: -0.1, z: 1.2, type: 'wheel_fl' }
    });

    // --- 6. Raycast Interaction & Mechanics Loop ---
    const raycaster = new THREE.Raycaster();
    const centerMouse = new THREE.Vector2(0, 0);

    function updateInteraction() {
        // Cast ray from camera center
        raycaster.setFromCamera(centerMouse, camera);
        const meshes = interactableObjects.map(o => o.mesh);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0 && intersects[0].distance < 3.5) {
            const intersectedMesh = intersects[0].object;
            const part = interactableObjects.find(o => o.mesh === intersectedMesh);

            if (part && !player.heldObject) {
                if (player.activeTool === 'screwdriver' && part.name === "Engine Block") {
                    promptElem.style.display = 'block';
                    promptElem.innerHTML = `Engine Air/Fuel Mix: ${part.tuningValues.fuelMix.toFixed(1)} <br>[Left Click] Lean (Screw Out) | [Q Key] Rich (Screw In)`;
                    
                    if (keys.q) { part.tuningValues.fuelMix = Math.max(10.0, part.tuningValues.fuelMix - 0.05); keys.q = false; }
                    return;
                }

                promptElem.style.display = 'block';
                promptElem.textContent = part.isAttached ? `[Left Click] Detach ${part.name}` : `[Left Click] Pick Up ${part.name}`;
                
                // If user clicks mouse, manage pickup/detach logic
                if (renderer.domElement.onclick_action) {
                    renderer.domElement.onclick_action = false;
                    if (part.isAttached) {
                        // Detach part back to simulation layer
                        part.isAttached = false;
                        part.body.wakeUp();
                        part.body.setBodyType(RAPIER.RigidBodyType.Dynamic);
                        part.body.setTranslation({ x: camera.position.x, y: camera.position.y - 0.2, z: camera.position.z });
                    } else {
                        player.heldObject = part;
                    }
                }
            }
        } else {
            promptElem.style.display = 'none';
        }

        // Manage Carried Object position transforms
        if (player.heldObject) {
            promptElem.style.display = 'block';
            promptElem.textContent = `Carrying ${player.heldObject.name} - [Left Click] Drop / Near Bay to Assemble`;

            const carryPos = new THREE.Vector3(0, -0.2, -1.2).applyQuaternion(camera.quaternion).add(camera.position);
            player.heldObject.body.setTranslation({ x: carryPos.x, y: carryPos.y, z: carryPos.z });
            player.heldObject.body.setLinvel({ x: 0, y: 0, z: 0 });

            // Assembly Check against vehicle core group targets
            if (player.heldObject.snapTarget) {
                const targetGlobalPos = new THREE.Vector3(player.heldObject.snapTarget.x, player.heldObject.snapTarget.y, player.heldObject.snapTarget.z).applyMatrix4(mainBody.matrixWorld);
                if (carryPos.distanceTo(targetGlobalPos) < 1.0) {
                    promptElem.textContent = `[Left Click] Assemble ${player.heldObject.name}`;
                    if (renderer.domElement.onclick_action) {
                        renderer.domElement.onclick_action = false;
                        const part = player.heldObject;
                        part.isAttached = true;
                        part.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
                        player.heldObject = null;
                    }
                }
            }

            // Drop mechanism standard logic
            if (renderer.domElement.onclick_action && player.heldObject) {
                renderer.domElement.onclick_action = false;
                player.heldObject = null;
            }
        }
    }

    // Monitor click processing injection safely
    window.addEventListener('mousedown', () => { if (document.pointerLockElement === container) renderer.domElement.onclick_action = true; });

    // --- 7. Main System Animation Tick ---
    function tick() {
        requestAnimationFrame(tick);
        world.step();

        // 1. Calculate FPS Walking Movement Matrix Vectors
        const headVector = new THREE.Vector3();
        if (keys.w) headVector.z -= 1;
        if (keys.s) headVector.z += 1;
        if (keys.a) headVector.x -= 1;
        if (keys.d) headVector.x += 1;
        headVector.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y).multiplyScalar(player.speed);
        const currentPos = player.body.translation();
        player.body.setNextKinematicTranslation({
        x: currentPos.x + headVector.x,
        y: currentPos.y,
        z: currentPos.z + headVector.z
        });
        camera.position.set(currentPos.x + headVector.x, currentPos.y + 0.6, currentPos.z + headVector.z);
  
    // 2. Sync Car Core Graphics Matrix
    const carPos = carRigidBody.translation();
    const carRot = carRigidBody.rotation();
    carGroup.position.set(carPos.x, carPos.y, carPos.z);
    carGroup.quaternion.set(carRot.x, carRot.y, carRot.z, carRot.w);
    // 3. Process Part Object Transforms based on Assembly states
    interactableObjects.forEach((part) => {
    if (part.isAttached) {
    const attachedMatrix = new THREE.Vector3(part.snapTarget.x, part.snapTarget.y, part.snapTarget.z).applyMatrix4(mainBody.matrixWorld);
    part.mesh.position.copy(attachedMatrix); 
    part.mesh.quaternion.copy(mainBody.quaternion);
    part.body.setTranslation({ x: attachedMatrix.x, y: attachedMatrix.y, z: attachedMatrix.z });
    } else {
    const partPos = part.body.translation();
    const partRot = part.body.rotation();
    part.mesh.position.set(partPos.x, partPos.y, partPos.z);
    part.mesh.quaternion.set(partRot.x, partRot.y, partRot.z, partRot.w);
    }
    });
    updateInteraction();
    renderer.render(scene, camera);
    }
    tick();
    window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    });
    }
