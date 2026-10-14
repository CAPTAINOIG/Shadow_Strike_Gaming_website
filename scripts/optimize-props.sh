#!/usr/bin/env bash
# Decimates the photogrammetry-heavy Poly Haven props (100k+ triangles each)
# into game-ready GLBs in public/assets/props/ph_opt/.
# Sources: the 1k glTF downloads from https://polyhaven.com (CC0), placed in
# public/assets/props/ph/<id>/<id>_1k.gltf before running.
# Requires: npx @gltf-transform/cli@4
set -euo pipefail
cd "$(dirname "$0")/../public/assets/props"
mkdir -p ph_opt

opt() { # id ratio error
  npx @gltf-transform/cli@4 optimize "ph/$1/$1_1k.gltf" "ph_opt/$1.glb" \
    --compress false --texture-compress false --texture-size 1024 \
    --simplify-ratio "$2" --simplify-error "$3" \
    --instance false --flatten false --join false --palette false
}

opt namaqualand_boulder_02 0.05 0.01
opt dead_tree_trunk 0.08 0.008
opt shrub_01 0.08 0.02
opt shrub_02 0.3 0.02
opt concrete_road_barrier 0.06 0.004
opt old_military_compressor 0.12 0.004
opt wooden_military_crate 0.3 0.003
opt plastic_crate_01 0.3 0.003
opt old_military_crate 0.5 0.003
opt covered_car 0.5 0.003
opt metal_jerrycan_green 0.5 0.003
