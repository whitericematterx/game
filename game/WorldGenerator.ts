
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { CHUNK_SIZE, BIOME_COLORS, WATER_LEVEL } from '../constants';
import { BiomeType } from '../types';

const noise2D = createNoise2D();
const continentNoise = createNoise2D();
const detailNoise = createNoise2D();

export interface Obstacle {
    x: number;
    z: number;
    r: number;
}

export class WorldGenerator {
    // Materials
    private woodMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, flatShading: true, roughness: 1.0 });
    private leafMat = new THREE.MeshStandardMaterial({ color: 0x66BB6A, flatShading: true, roughness: 0.8 });
    private pineLeafMat = new THREE.MeshStandardMaterial({ color: 0x1B5E20, flatShading: true, roughness: 0.8 });
    private sakuraLeafMat = new THREE.MeshStandardMaterial({ color: 0xF48FB1, flatShading: true, roughness: 0.7, emissive: 0x880E4F, emissiveIntensity: 0.1 }); 
    private cactusMat = new THREE.MeshStandardMaterial({ color: 0x76FF03, flatShading: true, roughness: 0.6 });
    private stoneMat = new THREE.MeshStandardMaterial({ color: 0x78909C, flatShading: true, roughness: 0.7 });
    
    private monolithMat = new THREE.MeshStandardMaterial({ 
        color: 0x212121, 
        emissive: 0x00E5FF, 
        emissiveIntensity: 2.5,
        roughness: 0.2,
        metalness: 0.9
    });

    // Grass Instance Geometry & Material
    private grassGeo: THREE.BufferGeometry;
    private grassMat: THREE.MeshStandardMaterial;
    private sakuraGrassMat: THREE.MeshStandardMaterial;

    constructor() {
        const blade = new THREE.PlaneGeometry(0.2, 0.8);
        blade.translate(0, 0.4, 0);
        this.grassGeo = blade;
        this.grassMat = new THREE.MeshStandardMaterial({
            color: 0xAED581,
            side: THREE.DoubleSide,
            roughness: 1.0,
            flatShading: true
        });
        this.sakuraGrassMat = new THREE.MeshStandardMaterial({
            color: 0xFCE4EC, 
            side: THREE.DoubleSide,
            roughness: 1.0,
            flatShading: true
        });
    }

    getBiome(x: number, z: number, height: number): BiomeType {
        if (height < WATER_LEVEL + 0.2) return BiomeType.WATER;
        if (height > 45) return BiomeType.MOUNTAIN;
        if (height > 30 && Math.random() > 0.5) return BiomeType.SNOW; 

        const temp = noise2D(x * 0.0015, z * 0.0015); // Temperature / Humidity map
        
        if (temp < -0.4) return BiomeType.DESERT;
        if (temp > 0.5) return BiomeType.FOREST;
        if (temp > 0.2 && temp <= 0.5) return BiomeType.SAKURA; 
        return BiomeType.PLAINS;
    }

    getHeight(x: number, z: number): number {
        // 1. Continental Shape (Low Frequency)
        // Positive = Land, Negative = Ocean
        // We offset by +0.15 to make land more common ("less deep ocean")
        let base = continentNoise(x * 0.0015, z * 0.0015) + 0.15;
        
        let h = 0;

        if (base > 0) {
            // --- LAND GENERATION ---
            
            // Base rolling terrain
            h = base * 15; 
            
            // Ridged Mountains (Sharp peaks)
            // Abs(noise) creates valleys, 1-Abs creates ridges. Pow() sharpens them.
            const ridge = 1.0 - Math.abs(noise2D(x * 0.004, z * 0.004));
            h += Math.pow(ridge, 3) * 45 * base; 

            // Texture/Roughness
            h += noise2D(x * 0.03, z * 0.03) * 1.5;
            
            // Ensure min height for land is above water so we don't have weird puddles
            h = Math.max(h, WATER_LEVEL + 0.5);
        } else {
            // --- OCEAN GENERATION ---
            // Gentle slope into the deep, but capped so it doesn't go to infinite abyss
            h = base * 20; 
            h = Math.max(h, -15); // Cap ocean depth
        }

        // Smooth Coastlines: Lerp heights near water level to create beaches
        if (h > WATER_LEVEL - 1 && h < WATER_LEVEL + 2) {
             h = THREE.MathUtils.lerp(h, WATER_LEVEL + 0.5, 0.4);
        }

        return h;
    }

    seededRandom(seed: number) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // --- Flora Generators ---

    private createOakTree(x: number, y: number, z: number): { trunk: THREE.BufferGeometry, leaves: THREE.BufferGeometry } {
        const scale = 0.8 + Math.random() * 0.6;
        const trunk = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 2.5 * scale, 5);
        trunk.translate(x, y + (1.25 * scale), z);
        
        // More simplified, fluffy look
        const l1 = new THREE.IcosahedronGeometry(1.5 * scale, 0);
        l1.translate(x, y + (3 * scale), z);
        const l2 = new THREE.IcosahedronGeometry(1.2 * scale, 0);
        l2.translate(x + 0.5, y + (3.5 * scale), z + 0.5);
        
        const leaves = BufferGeometryUtils.mergeGeometries([l1, l2]);
        return { trunk, leaves };
    }

    private createSakuraTree(x: number, y: number, z: number): { trunk: THREE.BufferGeometry, leaves: THREE.BufferGeometry } {
        const scale = 1.0 + Math.random() * 0.4;
        const trunk = new THREE.CylinderGeometry(0.2 * scale, 0.4 * scale, 3.5 * scale, 5);
        trunk.rotateZ(0.1);
        trunk.translate(x, y + (1.75 * scale), z);
        
        const l1 = new THREE.DodecahedronGeometry(1.8 * scale, 0);
        l1.translate(x + 0.3, y + (3.8 * scale), z);
        const l2 = new THREE.DodecahedronGeometry(1.2 * scale, 0);
        l2.translate(x - 0.8, y + (3.0 * scale), z + 0.5);

        const leaves = BufferGeometryUtils.mergeGeometries([l1, l2]);
        return { trunk, leaves };
    }

    private createPineTree(x: number, y: number, z: number): { trunk: THREE.BufferGeometry, leaves: THREE.BufferGeometry } {
        const scale = 1.0 + Math.random() * 0.8;
        const trunk = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 2 * scale, 5);
        trunk.translate(x, y + (1 * scale), z);
        
        const l1 = new THREE.ConeGeometry(2.5 * scale, 3 * scale, 5);
        l1.translate(x, y + 2.5 * scale, z);
        const l2 = new THREE.ConeGeometry(1.8 * scale, 3 * scale, 5);
        l2.translate(x, y + 4.5 * scale, z);

        const leaves = BufferGeometryUtils.mergeGeometries([l1, l2]);
        return { trunk, leaves };
    }

    private createCactus(x: number, y: number, z: number): THREE.BufferGeometry {
        const height = 2 + Math.random() * 2;
        const base = new THREE.CylinderGeometry(0.3, 0.3, height, 6);
        base.translate(x, y + height/2, z);
        
        const top = new THREE.SphereGeometry(0.3, 6, 5);
        top.translate(x, y + height, z);

        const parts = [base, top];
        if (Math.random() > 0.5) {
             const arm = new THREE.CylinderGeometry(0.25, 0.25, 1, 5);
             arm.rotateZ(Math.PI/2);
             arm.translate(x + 0.5, y + height * 0.6, z);
             parts.push(arm);
             
             const armUp = new THREE.CylinderGeometry(0.25, 0.25, 1, 5);
             armUp.translate(x + 0.9, y + height * 0.6 + 0.5, z);
             parts.push(armUp);
        }
        return BufferGeometryUtils.mergeGeometries(parts);
    }

    private createRock(x: number, y: number, z: number, scale: number): THREE.BufferGeometry {
        const geo = new THREE.DodecahedronGeometry(scale, 0);
        geo.rotateX(Math.random() * 6);
        geo.rotateY(Math.random() * 6);
        geo.scale(1, 0.7, 1); 
        geo.translate(x, y + scale * 0.3, z);
        return geo;
    }

    generateChunk(chunkX: number, chunkZ: number): { mesh: THREE.Group, colliders: THREE.Object3D[], obstacles: Obstacle[] } {
        const chunkGroup = new THREE.Group();
        const chunkWorldX = chunkX * CHUNK_SIZE;
        const chunkWorldZ = chunkZ * CHUNK_SIZE;
        const chunkSeed = chunkX * 49297 + chunkZ * 92713; 

        const obstacles: Obstacle[] = [];
        
        // --- TERRAIN MESH ---
        const segments = 32; 
        const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);
        geometry.rotateX(-Math.PI / 2);
        
        const positions = geometry.attributes.position;
        const colors = [];
        const color = new THREE.Color();

        const grassPositions: THREE.Matrix4[] = [];
        const sakuraGrassPositions: THREE.Matrix4[] = [];
        const dummy = new THREE.Object3D();

        for (let i = 0; i < positions.count; i++) {
            const localX = positions.getX(i);
            const localZ = positions.getZ(i);
            const worldX = localX + chunkWorldX;
            const worldZ = localZ + chunkWorldZ;

            const y = this.getHeight(worldX, worldZ);
            positions.setY(i, y);

            const biome = this.getBiome(worldX, worldZ, y);
            const baseColorHex = BIOME_COLORS[biome];
            color.setHex(baseColorHex);

            // Subtle Noise variation for ground texture
            const n = noise2D(worldX * 0.1, worldZ * 0.1);
            
            if (biome !== BiomeType.SNOW && biome !== BiomeType.WATER) {
                color.offsetHSL(0, 0, n * 0.04);
            }

            // Sand blend near water (Beaches)
            if (y > WATER_LEVEL && y < WATER_LEVEL + 4.0 && biome !== BiomeType.WATER) {
                // Stronger blend for clearer beaches
                const blendFactor = 1.0 - ((y - WATER_LEVEL) / 4.0);
                color.lerp(new THREE.Color(BIOME_COLORS[BiomeType.DESERT]), blendFactor);
            }
            
            // Mountain peaks snow blend
            if (y > 45) {
                color.lerp(new THREE.Color(BIOME_COLORS[BiomeType.SNOW]), (y - 45) / 25);
            }

            colors.push(color.r, color.g, color.b);

            // Grass Generation
            if (y > WATER_LEVEL + 2 && y < 40) {
                 const grassNoise = detailNoise(worldX * 0.2, worldZ * 0.2);
                 
                 // Regular Grass
                 if (biome === BiomeType.PLAINS || biome === BiomeType.FOREST) {
                     if (grassNoise > 0.1 && Math.random() > 0.7) {
                         const gx = localX + (Math.random() - 0.5) * 2;
                         const gz = localZ + (Math.random() - 0.5) * 2;
                         const gy = this.getHeight(gx + chunkWorldX, gz + chunkWorldZ);
                         dummy.position.set(gx, gy, gz);
                         dummy.rotation.y = Math.random() * Math.PI;
                         const s = 0.8 + Math.random() * 0.5;
                         dummy.scale.set(s, s, s);
                         dummy.updateMatrix();
                         grassPositions.push(dummy.matrix.clone());
                     }
                 } 
                 // Sakura Grass
                 else if (biome === BiomeType.SAKURA) {
                     if (grassNoise > 0.0 && Math.random() > 0.6) {
                         const gx = localX + (Math.random() - 0.5) * 2;
                         const gz = localZ + (Math.random() - 0.5) * 2;
                         const gy = this.getHeight(gx + chunkWorldX, gz + chunkWorldZ);
                         dummy.position.set(gx, gy, gz);
                         dummy.rotation.y = Math.random() * Math.PI;
                         const s = 0.8 + Math.random() * 0.4;
                         dummy.scale.set(s, s, s);
                         dummy.updateMatrix();
                         sakuraGrassPositions.push(dummy.matrix.clone());
                     }
                 }
            }
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        
        const terrainMat = new THREE.MeshStandardMaterial({ 
            vertexColors: true, 
            roughness: 1.0, 
            metalness: 0.0,
            flatShading: true
        });
        const terrain = new THREE.Mesh(geometry, terrainMat);
        terrain.receiveShadow = true;
        terrain.castShadow = true;
        chunkGroup.add(terrain);
        chunkGroup.position.set(chunkWorldX, 0, chunkWorldZ);

        // Instanced Grass Rendering
        if (grassPositions.length > 0) {
            const grassMesh = new THREE.InstancedMesh(this.grassGeo, this.grassMat, grassPositions.length);
            for (let i = 0; i < grassPositions.length; i++) grassMesh.setMatrixAt(i, grassPositions[i]);
            grassMesh.receiveShadow = true;
            chunkGroup.add(grassMesh);
        }
        if (sakuraGrassPositions.length > 0) {
            const sGrassMesh = new THREE.InstancedMesh(this.grassGeo, this.sakuraGrassMat, sakuraGrassPositions.length);
            for (let i = 0; i < sakuraGrassPositions.length; i++) sGrassMesh.setMatrixAt(i, sakuraGrassPositions[i]);
            sGrassMesh.receiveShadow = true;
            chunkGroup.add(sGrassMesh);
        }

        // --- OBJECT SCATTERING ---
        const geos: Record<string, THREE.BufferGeometry[]> = {
            trunks: [], oakLeaves: [], pineLeaves: [], sakuraLeaves: [], 
            cacti: [], stones: []
        };
        
        // Monolith (Rare POI)
        if (this.seededRandom(chunkSeed) > 0.97) {
            const lx = 0;
            const lz = 0;
            const wx = lx + chunkWorldX;
            const wz = lz + chunkWorldZ;
            const hy = this.getHeight(wx, wz);
            
            if (hy > WATER_LEVEL + 2) {
                const h = 18; 
                const w = 3.5;
                const mGeo = new THREE.BoxGeometry(w, h, w);
                mGeo.translate(0, h/2, 0);
                const mMesh = new THREE.Mesh(mGeo, this.monolithMat);
                mMesh.position.set(lx, hy - 3, lz);
                mMesh.castShadow = true;
                mMesh.userData = { isPOI: true };
                
                const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), this.monolithMat);
                orb.position.y = h + 3.5;
                
                mMesh.add(orb);
                mMesh.add(new THREE.PointLight(0x00E5FF, 5, 50));

                chunkGroup.add(mMesh);
                obstacles.push({ x: wx, z: wz, r: 4.0 });
            }
        }

        const density = 4; 
        for (let x = -CHUNK_SIZE/2; x < CHUNK_SIZE/2; x+= density) {
            for (let z = -CHUNK_SIZE/2; z < CHUNK_SIZE/2; z+= density) {
                const lx = x + (this.seededRandom(x * 11 + z) - 0.5) * density;
                const lz = z + (this.seededRandom(z * 13 + x) - 0.5) * density;
                const wx = lx + chunkWorldX;
                const wz = lz + chunkWorldZ;
                const y = this.getHeight(wx, wz);
                
                if (y <= WATER_LEVEL + 0.5) continue;

                const biome = this.getBiome(wx, wz, y);
                const rVal = this.seededRandom(wx * wz);
                
                // PEBBLES / GROUND DETAIL (High frequency)
                if (rVal < 0.15 && biome !== BiomeType.WATER && biome !== BiomeType.SNOW) {
                     const s = 0.2 + Math.random() * 0.3;
                     geos.stones.push(this.createRock(lx, y, lz, s));
                     continue;
                }
                
                // BOULDERS
                if (rVal < 0.03 && biome !== BiomeType.WATER) {
                    const s = 0.8 + Math.random() * 1.2;
                    geos.stones.push(this.createRock(lx, y, lz, s));
                    obstacles.push({ x: wx, z: wz, r: s * 0.8 });
                    continue;
                }

                // TREES
                if (biome === BiomeType.FOREST && rVal > 0.4) {
                    const t = rVal > 0.75 ? this.createPineTree(lx, y, lz) : this.createOakTree(lx, y, lz);
                    geos.trunks.push(t.trunk);
                    if (rVal > 0.75) geos.pineLeaves.push(t.leaves); else geos.oakLeaves.push(t.leaves);
                    obstacles.push({ x: wx, z: wz, r: 0.8 });
                } 
                else if (biome === BiomeType.SAKURA && rVal > 0.65) {
                    const t = this.createSakuraTree(lx, y, lz);
                    geos.trunks.push(t.trunk);
                    geos.sakuraLeaves.push(t.leaves);
                    obstacles.push({ x: wx, z: wz, r: 0.6 });
                }
                else if (biome === BiomeType.PLAINS && rVal > 0.97) {
                    const t = this.createOakTree(lx, y, lz);
                    geos.trunks.push(t.trunk);
                    geos.oakLeaves.push(t.leaves);
                    obstacles.push({ x: wx, z: wz, r: 0.8 });
                }
                else if (biome === BiomeType.DESERT && rVal > 0.96) {
                    geos.cacti.push(this.createCactus(lx, y, lz));
                    obstacles.push({ x: wx, z: wz, r: 0.5 });
                }
            }
        }

        const mergeAndAdd = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
            if (list.length > 0) {
                const m = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(list), mat);
                m.castShadow = true;
                m.receiveShadow = true;
                chunkGroup.add(m);
                return m;
            }
            return null;
        };

        const colliders: THREE.Object3D[] = [terrain];
        
        mergeAndAdd(geos.trunks, this.woodMat);
        mergeAndAdd(geos.oakLeaves, this.leafMat);
        mergeAndAdd(geos.pineLeaves, this.pineLeafMat);
        mergeAndAdd(geos.sakuraLeaves, this.sakuraLeafMat);
        mergeAndAdd(geos.cacti, this.cactusMat);
        const stoneMesh = mergeAndAdd(geos.stones, this.stoneMat);
        if (stoneMesh) colliders.push(stoneMesh);

        return { mesh: chunkGroup, colliders, obstacles };
    }
}
