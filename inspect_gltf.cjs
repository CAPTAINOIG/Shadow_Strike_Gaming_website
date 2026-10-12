const fs = require('fs');
const male = JSON.parse(fs.readFileSync('public/models/Superhero_Male_FullBody.gltf', 'utf8'));
console.log('=== Materials ===');
male.materials.forEach((m, i) => {
  console.log('Material #' + i + ': ' + m.name);
  if (m.pbrMetallicRoughness) {
    console.log('  baseColorFactor:', JSON.stringify(m.pbrMetallicRoughness.baseColorFactor));
    console.log('  baseColorTexture:', m.pbrMetallicRoughness.baseColorTexture ? 'index=' + m.pbrMetallicRoughness.baseColorTexture.index : 'none');
    console.log('  metallicFactor:', m.pbrMetallicRoughness.metallicFactor);
    console.log('  roughnessFactor:', m.pbrMetallicRoughness.roughnessFactor);
  }
  if (m.normalTexture) console.log('  normalTexture: index=' + m.normalTexture.index);
  if (m.emissiveFactor) console.log('  emissiveFactor:', JSON.stringify(m.emissiveFactor));
});
console.log('');
console.log('=== Images ===');
male.images.forEach((img, i) => console.log('Image #' + i + ': ' + img.uri));
console.log('');
console.log('=== Meshes ===');
male.meshes.forEach((mesh, i) => {
  console.log('Mesh #' + i + ': ' + mesh.name);
  mesh.primitives.forEach((p, j) => {
    console.log('  primitive ' + j + ' -> material ' + p.material);
  });
});
