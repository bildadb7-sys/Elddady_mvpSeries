const fs = require('fs');
const svg = fs.readFileSync('public/ELDDADY2_transprnt_Y2.svg', 'utf8');

// The transform says translate(19.403578,23.284294)
// Let's do a quick manual approximation or just crop using scale
// We can just overwrite the SVG file's viewBox to scale it up.
// Let's print out some bounding box info if we can, or just replace the viewBox and see.
const newSvg = svg.replace('viewBox="0 0 976 976"', 'viewBox="195 245 490 310"');
fs.writeFileSync('public/ELDDADY2_transprnt_Y2_cropped.svg', newSvg);
console.log('Saved cropped SVG');
