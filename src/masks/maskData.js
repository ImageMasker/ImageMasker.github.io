export const PRESET_MASKS = [
{
  id: 1,
  name: "Weave",
  thumb: "images/1_thumb.avif",
  full: "images/1.avif",
  defaultAlpha: 75,
  // Drawn live with Ed Harvey's weave (gl/patterns.js); `full` stays for sessions saved before.
  pattern: { id: "weave", params: { density: 15 } }
},
{
  id: 2,
  name: "Bendy weave",
  thumb: "images/2_thumb.avif",
  full: "images/2.avif",
  defaultAlpha: 75
},
{
  id: 3,
  name: "The wobbler",
  thumb: "images/3_thumb.avif",
  full: "images/3.avif",
  defaultAlpha: 75,
  pattern: { id: "weave", params: { density: 14, wobble: 13, wavelen: 1, wobangle: 0 } }
},
{
  id: 4,
  name: "Circles",
  thumb: "images/4_thumb.avif",
  full: "images/4.avif",
  defaultAlpha: 65
},
{
  id: 5,
  name: "Diamonds",
  thumb: "images/5_thumb.avif",
  full: "images/5.avif",
  defaultAlpha: 65
},
{
  id: 6,
  name: "Patches",
  thumb: "images/6_thumb.avif",
  full: "images/6.avif",
  defaultAlpha: 60
},
{
  id: 7,
  name: "Leaves",
  thumb: "images/7_thumb.avif",
  full: "images/7.avif",
  defaultAlpha: 60
},
{
  id: 8,
  name: "Fruit salad",
  thumb: "images/8_thumb.avif",
  full: "images/8.avif",
  defaultAlpha: 65
},
{
  id: 9,
  name: "Red waves",
  thumb: "images/9_thumb.avif",
  full: "images/9.avif",
  defaultAlpha: 75
}
];
