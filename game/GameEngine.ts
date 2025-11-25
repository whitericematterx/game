
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { WorldGenerator, Obstacle } from './WorldGenerator';
import { CHUNK_SIZE, RENDER_DISTANCE, KEYS, STAMINA_MAX, FLIGHT_COST, REGEN_RATE, WATER_LEVEL, SKY_COLORS, BIOME_COLORS } from '../constants';
import { PlayerStats, BiomeType } from '../types';

interface ChunkData {
    mesh: THREE.Group;
    obstacles: Obstacle[];
}

export class GameEngine {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    
    private worldGen: WorldGenerator;
    private chunks: Map<string, ChunkData> = new Map();
    private colliders: THREE.Object3D[] = [];
    
    private player: THREE.Group;
    private playerVelocity: THREE.Vector3 = new THREE.Vector3();
    private playerOnGround: boolean = false;
    
    private keysPressed: Record<string, boolean> = {};
    private lastTime: number = 0;
    
    private statsCallback: (stats: PlayerStats) => void;
    private poiCallback: (poi: boolean) => void;
    
    private stamina: number = STAMINA_MAX;
    private timeOfDay: number = 0.2; 
    
    private sun: THREE.DirectionalLight;
    private ambient: THREE.HemisphereLight;
    private water: THREE.Mesh;
    private particles: THREE.Points;
    private clouds: THREE.InstancedMesh;
    
    private poiNearby: THREE.Vector3 | null = null;

    private headBobTimer = 0;
    private cameraBaseY = 1.7;
    private targetCamTilt = 0;
    private currentCamTilt = 0;

    private scannerBeam: THREE.Line | null = null;

    private handleKeyDown: (e: KeyboardEvent) => void;
    private handleKeyUp: (e: KeyboardEvent) => void;
    private handleMouseMove: (e: MouseEvent) => void;
    private handleMouseDown: (e: MouseEvent) => void;
    private handleResize: () => void;
    private animationId: number | null = null;
    private lastLockRequest: number = 0;

    constructor(
        container: HTMLElement, 
        statsCallback: (stats: PlayerStats) => void,
        poiCallback: (available: boolean) => void
    ) {
        this.statsCallback = statsCallback;
        this.poiCallback = poiCallback;
        this.worldGen = new WorldGenerator();
        
        // Scene
        this.scene = new THREE.Scene();
        // Use FogExp2 for a thicker, softer atmosphere
        this.scene.fog = new THREE.FogExp2(SKY_COLORS.DAY, 0.004); 
        
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2; 
        container.appendChild(this.renderer.domElement);

        // Post Processing
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Bloom - adjusted for "Dreamy" look
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.6; 
        bloomPass.strength = 0.35; 
        bloomPass.radius = 0.8;
        this.composer.addPass(bloomPass);

        // Lights
        // Hemisphere light gives good ambient fill (Sky color vs Ground color)
        this.ambient = new THREE.HemisphereLight(SKY_COLORS.DAY, 0x333333, 0.6); 
        this.scene.add(this.ambient);

        this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
        this.sun.position.set(50, 100, 50);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 300;
        const sSize = 100;
        this.sun.shadow.camera.left = -sSize;
        this.sun.shadow.camera.right = sSize;
        this.sun.shadow.camera.top = sSize;
        this.sun.shadow.camera.bottom = -sSize;
        this.sun.shadow.bias = -0.0005;
        this.scene.add(this.sun);

        // Player
        this.player = new THREE.Group();
        this.player.add(this.camera);
        this.camera.position.y = this.cameraBaseY;
        // Start high up to avoid spawning in ground
        this.player.position.set(0, 80, 0);
        this.scene.add(this.player);

        this.initWater();
        this.initParticles();
        this.initFluffyClouds();

        // Listeners
        this.handleKeyDown = (e: KeyboardEvent) => { this.keysPressed[e.code] = true; };
        this.handleKeyUp = (e: KeyboardEvent) => { this.keysPressed[e.code] = false; };
        this.handleMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement === this.renderer.domElement) {
                const sensitivity = 0.002;
                this.player.rotation.y -= e.movementX * sensitivity;
                this.camera.rotation.x -= e.movementY * sensitivity;
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            }
        };
        this.handleMouseDown = (e: MouseEvent) => {
            if (document.pointerLockElement !== this.renderer.domElement) {
                 this.requestPointerLock();
            }
        };
        this.handleResize = this.onWindowResize.bind(this);

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mousedown', this.handleMouseDown);
        window.addEventListener('resize', this.handleResize);

        this.lastTime = performance.now();
        this.animate();
    }

    private initWater() {
        const waterGeo = new THREE.PlaneGeometry(2000, 2000, 128, 128);
        waterGeo.rotateX(-Math.PI / 2);
        
        // Cartoon-ish stylized water
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: BIOME_COLORS[BiomeType.WATER], // Teal
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.6, 
            thickness: 2.0,
            transparent: true,
            opacity: 0.85,
            ior: 1.33,
            reflectivity: 0.5,
            clearcoat: 1.0,
            side: THREE.DoubleSide
        });

        this.water = new THREE.Mesh(waterGeo, waterMat);
        this.water.position.y = WATER_LEVEL;
        this.scene.add(this.water);
    }

    private initParticles() {
        const particleCount = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const range = 300;

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * range;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 100 + 30;
            positions[i * 3 + 2] = (Math.random() - 0.5) * range;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 0.1,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    private initFluffyClouds() {
        const spheres = [];
        // Create a more complex cloud shape
        for(let i = 0; i < 12; i++) {
            const r = 8 + Math.random() * 10;
            const geo = new THREE.SphereGeometry(r, 7, 7);
            geo.translate(
                (Math.random() - 0.5) * 35,
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 20
            );
            spheres.push(geo);
        }
        const cloudGeo = BufferGeometryUtils.mergeGeometries(spheres);
        
        const cloudMat = new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF, 
            transparent: true, 
            opacity: 0.9,
            flatShading: true,
            roughness: 0.9,
            metalness: 0.0,
            emissive: 0xFFFFFF,
            emissiveIntensity: 0.1
        });
        
        const count = 40;
        this.clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, count);
        
        const dummy = new THREE.Object3D();
        for(let i=0; i<count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * 1000,
                100 + Math.random() * 50,
                (Math.random() - 0.5) * 1000
            );
            const s = 2 + Math.random() * 3;
            dummy.scale.set(s, s * 0.6, s);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.updateMatrix();
            this.clouds.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(this.clouds);
    }

    private updateClouds(delta: number) {
        const count = this.clouds.count;
        const dummy = new THREE.Object3D();
        const m = new THREE.Matrix4();
        const speed = 4 * delta;

        for(let i=0; i<count; i++) {
            this.clouds.getMatrixAt(i, m);
            m.decompose(dummy.position, dummy.quaternion, dummy.scale);
            
            dummy.position.x += speed;
            if (dummy.position.x > 500) dummy.position.x = -500;
            
            dummy.updateMatrix();
            this.clouds.setMatrixAt(i, dummy.matrix);
        }
        this.clouds.instanceMatrix.needsUpdate = true;
    }

    public requestPointerLock() {
        const now = Date.now();
        if (now - this.lastLockRequest < 1000) return;
        if (document.pointerLockElement === this.renderer.domElement) return;
        
        this.lastLockRequest = now;
        try {
            this.renderer.domElement.requestPointerLock();
        } catch (e) {
            console.warn(e);
        }
    }

    private updateChunks() {
        const px = Math.floor(this.player.position.x / CHUNK_SIZE);
        const pz = Math.floor(this.player.position.z / CHUNK_SIZE);

        // Unload far chunks
        for (const [key, data] of this.chunks) {
            const [cx, cz] = key.split(',').map(Number);
            if (Math.abs(cx - px) > RENDER_DISTANCE || Math.abs(cz - pz) > RENDER_DISTANCE) {
                this.scene.remove(data.mesh);
                this.colliders = this.colliders.filter(c => !data.mesh.children.includes(c as THREE.Mesh) && c !== data.mesh);
                this.chunks.delete(key);
                data.mesh.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) obj.geometry.dispose();
                });
            }
        }

        this.poiNearby = null;
        let hasPOI = false;

        for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
            for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
                const cx = px + x;
                const cz = pz + z;
                const key = `${cx},${cz}`;

                if (!this.chunks.has(key)) {
                    const { mesh, colliders, obstacles } = this.worldGen.generateChunk(cx, cz);
                    this.scene.add(mesh);
                    this.chunks.set(key, { mesh, obstacles });
                    this.colliders.push(...colliders);
                }
                
                const data = this.chunks.get(key);
                if (data && data.mesh) {
                     data.mesh.children.forEach(child => {
                         if (child.userData.isPOI) {
                             const worldPos = new THREE.Vector3();
                             child.getWorldPosition(worldPos);
                             // Check if we are looking roughly at it? 
                             // For now just distance check for simple interaction
                             if (worldPos.distanceTo(this.player.position) < 25) {
                                 this.poiNearby = worldPos;
                                 hasPOI = true;
                             }
                         }
                     });
                }
            }
        }
        this.poiCallback(hasPOI);
    }

    private updatePhysics(delta: number) {
        const isSprinting = this.keysPressed[KEYS.SPRINT] && this.stamina > 0;
        const moveSpeed = isSprinting ? 18 : 10; 
        
        if (isSprinting) {
            this.stamina = Math.max(0, this.stamina - FLIGHT_COST * delta * 0.4);
        } else if (this.stamina < STAMINA_MAX) {
            this.stamina = Math.min(STAMINA_MAX, this.stamina + REGEN_RATE * delta);
        }

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.player.quaternion);
        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();

        const moveDir = new THREE.Vector3();
        if (this.keysPressed[KEYS.FORWARD]) moveDir.add(forward);
        if (this.keysPressed[KEYS.BACKWARD]) moveDir.sub(forward);
        if (this.keysPressed[KEYS.RIGHT]) moveDir.add(right);
        if (this.keysPressed[KEYS.LEFT]) moveDir.sub(right);
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        // Physics
        this.playerVelocity.x -= this.playerVelocity.x * 10.0 * delta; 
        this.playerVelocity.z -= this.playerVelocity.z * 10.0 * delta;
        this.playerVelocity.y -= 50.0 * delta; // Stronger gravity

        if (moveDir.lengthSq() > 0) {
            this.playerVelocity.x += moveDir.x * moveSpeed * 20.0 * delta; 
            this.playerVelocity.z += moveDir.z * moveSpeed * 20.0 * delta;
            
            if (this.playerOnGround) {
                this.headBobTimer += delta * (isSprinting ? 18 : 12);
                this.camera.position.y = this.cameraBaseY + Math.sin(this.headBobTimer) * 0.15;
            }
        } else {
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.cameraBaseY, delta * 6);
        }

        if (this.keysPressed[KEYS.JUMP]) {
            if (this.playerOnGround) {
                this.playerVelocity.y = 18; 
            } else if (this.stamina > 5) {
                this.playerVelocity.y += 70 * delta; 
                this.stamina -= FLIGHT_COST * delta;
            }
        }

        let nextPosition = this.player.position.clone().add(
            new THREE.Vector3(this.playerVelocity.x * delta, this.playerVelocity.y * delta, this.playerVelocity.z * delta)
        );

        // Collision - Obstacles
        const playerRadius = 0.7;
        const px = Math.floor(this.player.position.x / CHUNK_SIZE);
        const pz = Math.floor(this.player.position.z / CHUNK_SIZE);
        
        const checkCollision = (obs: Obstacle) => {
            const dx = nextPosition.x - obs.x;
            const dz = nextPosition.z - obs.z;
            const distSq = dx * dx + dz * dz;
            const minDist = playerRadius + obs.r;
            
            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq);
                const push = minDist - dist;
                if (dist > 0.001) {
                    nextPosition.x += (dx / dist) * push;
                    nextPosition.z += (dz / dist) * push;
                }
            }
        };

        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                const key = `${px+x},${pz+z}`;
                const chunk = this.chunks.get(key);
                if (chunk && chunk.obstacles) {
                    for (const obs of chunk.obstacles) checkCollision(obs);
                }
            }
        }

        // Collision - Ground
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(nextPosition.x, 150, nextPosition.z),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = raycaster.intersectObjects(this.colliders, false);
        let groundHeight = -200;
        if (intersects.length > 0) groundHeight = intersects[0].point.y;

        this.playerOnGround = false;
        if (nextPosition.y < groundHeight + 1.6) {
            nextPosition.y = groundHeight + 1.6;
            this.playerVelocity.y = Math.max(0, this.playerVelocity.y);
            this.playerOnGround = true;
        }
        
        // Respawn floor
        if (nextPosition.y < -50) nextPosition.y = 100; 

        this.player.position.copy(nextPosition);

        // Camera Tilt
        this.targetCamTilt = 0;
        if (this.keysPressed[KEYS.LEFT]) this.targetCamTilt = 0.05;
        if (this.keysPressed[KEYS.RIGHT]) this.targetCamTilt = -0.05;
        this.currentCamTilt = THREE.MathUtils.lerp(this.currentCamTilt, this.targetCamTilt, delta * 5);
        this.camera.rotation.z = this.currentCamTilt;
    }

    private updateDayNight(delta: number) {
        this.timeOfDay += delta * 0.005; // Slower day cycle
        if (this.timeOfDay > 1) this.timeOfDay = 0;

        const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
        const radius = 400;
        
        this.sun.position.set(
            this.player.position.x + Math.cos(angle) * radius, 
            Math.sin(angle) * radius, 
            this.player.position.z + Math.sin(angle * 0.5) * 100
        );
        
        const sunHeight = Math.sin(angle);
        const intensity = THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.2);
        this.sun.intensity = intensity * 2.2;

        const nightColor = new THREE.Color(SKY_COLORS.NIGHT);
        const dayColor = new THREE.Color(SKY_COLORS.DAY);
        const duskColor = new THREE.Color(SKY_COLORS.DUSK);
        
        let skyColor = new THREE.Color();
        if (sunHeight < -0.1) {
            skyColor.copy(nightColor);
            this.ambient.groundColor.setHex(0x050505);
            this.ambient.color.copy(nightColor).multiplyScalar(0.2);
        } else if (sunHeight < 0.15) {
            const t = (sunHeight + 0.1) / 0.25;
            skyColor.lerpColors(nightColor, duskColor, t);
            this.ambient.groundColor.setHex(0x221100);
             this.ambient.color.copy(duskColor).multiplyScalar(0.5);
        } else if (sunHeight < 0.4) {
            const t = (sunHeight - 0.15) / 0.25;
            skyColor.lerpColors(duskColor, dayColor, t);
            this.ambient.groundColor.setHex(0x3E2723);
            this.ambient.color.copy(dayColor).multiplyScalar(0.6);
        } else {
            skyColor.copy(dayColor);
            this.ambient.groundColor.setHex(0x4E342E);
            this.ambient.color.copy(dayColor).multiplyScalar(0.7);
        }
        
        this.scene.background = skyColor;
        if (this.scene.fog instanceof THREE.FogExp2) {
            this.scene.fog.color.copy(skyColor).lerp(new THREE.Color(0xFFFFFF), 0.3);
            const targetDensity = sunHeight > 0 ? 0.004 : 0.002;
            this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, delta * 0.5);
        }
    }

    public animate = () => {
        this.animationId = requestAnimationFrame(this.animate);
        const now = performance.now();
        const delta = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.updatePhysics(delta);
        this.updateChunks();
        this.updateDayNight(delta);
        this.updateClouds(delta);
        
        if (this.water) {
             const positions = this.water.geometry.attributes.position;
             for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const z = positions.getZ(i);
                // More complex wave pattern
                const wave = Math.sin(x * 0.05 + now * 0.001) * 0.3 + Math.cos(z * 0.04 + now * 0.0008) * 0.3;
                positions.setY(i, wave);
             }
             positions.needsUpdate = true;
             this.water.position.x = this.player.position.x;
             this.water.position.z = this.player.position.z;
        }

        const biome = this.worldGen.getBiome(this.player.position.x, this.player.position.z, this.player.position.y);
        
        this.statsCallback({
            position: this.player.position,
            stamina: this.stamina,
            isFlying: !this.playerOnGround && this.stamina < STAMINA_MAX,
            biome: biome,
            timeOfDay: this.timeOfDay
        });

        this.composer.render();
    }

    public getClosestPOI() {
        if (this.poiNearby) {
            const biome = this.worldGen.getBiome(this.poiNearby.x, this.poiNearby.z, this.poiNearby.y);
            return { position: this.poiNearby, biome };
        }
        return null;
    }

    public startScanEffect() {
        if (!this.poiNearby) return;
        const points = [
            new THREE.Vector3(0, -0.5, -1).applyMatrix4(this.camera.matrixWorld),
            this.poiNearby
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x00E5FF, linewidth: 3, transparent: true, opacity: 0.8 });
        this.scannerBeam = new THREE.Line(geo, mat);
        this.scene.add(this.scannerBeam);
        
        setTimeout(() => {
            if (this.scannerBeam) {
                this.scene.remove(this.scannerBeam);
                this.scannerBeam = null;
            }
        }, 600);
    }

    public getTimeStr() {
        const hour = Math.floor(this.timeOfDay * 24);
        if (hour < 5) return "Deep Night";
        if (hour < 9) return "Dawn";
        if (hour < 17) return "Day";
        if (hour < 20) return "Dusk";
        return "Night";
    }

    public dispose() {
        if (this.animationId !== null) cancelAnimationFrame(this.animationId);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mousedown', this.handleMouseDown);
        window.removeEventListener('resize', this.handleResize);
        if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        this.renderer.dispose();
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }
}
