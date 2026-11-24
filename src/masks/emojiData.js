// Emoji masks: the emoji palette, ready-made sets and the slider definition.
//
// Each palette entry has a short English description. The descriptions are what the optional
// "From the picture" detector compares the picture with, together with the extra emojis in
// pictureEmojis.js (see dev/emoji-embeddings.html, which turns them into
// src/masks/emojiEmbeddings.json), so describe what the emoji shows in a photo. Adding, removing
// or rewording entries needs that file to be regenerated.

import { DISCORD_EMOJIS } from './discordEmojis.js';

const R = (key, label, min, max, value, step = 1) => ({ key, label, type: 'range', min, max, value, step });

/** Sliders of an emoji mask (normalised like effect and pattern params). */
export const EMOJI_MASK = {
  id: 'emoji',
  name: 'Emoji',
  params: [
    // Indexes are EMOJI_STYLES values (raster/emojiArt.js).
    { key: 'style', label: 'Emoji style', type: 'select', options: ['Twemoji', 'This device', 'Google blobs'], value: 0 },
    R('density', 'Density', 2, 40, 9),
    R('size', 'Emoji size', 20, 400, 95),
    R('variety', 'Size variety', 0, 100, 35),
    R('turn', 'Rotation', 0, 180, 25),
    R('scatter', 'Scatter', 0, 100, 55),
    { key: 'bg', label: 'Background', type: 'color', value: '#f4efe6' },
    R('bgAlpha', 'Background opacity', 0, 100, 0),
  ],
};

// Entries are [emoji, description], in rows of things that belong together.
export const EMOJI_PALETTE = [
  {
    id: 'faces',
    label: 'Faces & people',
    items: [
      ['😀', 'a smiling face'], ['😂', 'a laughing face with tears'], ['😍', 'a face with heart eyes'], ['😎', 'a face with sunglasses'],
      ['🤔', 'a thinking face'], ['😴', 'a sleeping face'], ['😱', 'a screaming scared face'], ['🤯', 'a mind blown face'], ['🥳', 'a party face'],
      ['🤡', 'a clown'], ['👻', 'a ghost'], ['💀', 'a skull'], ['👽', 'an alien'], ['🤖', 'a robot'], ['🧛', 'a vampire'], ['🧟', 'a zombie'],
      ['🐦‍🔥', 'a phoenix'],
      ['👶', 'a baby'], ['👧', 'a girl'], ['👦', 'a boy'], ['👩', 'a woman'], ['👨', 'a man'], ['👵', 'an old woman'], ['👴', 'an old man'],
      ['💃', 'a woman dancing'], ['🏃', 'a person running'], ['🧘', 'a person doing yoga'], ['👥', 'a crowd of people'],
      ['👮', 'a police officer'], ['👷', 'a construction worker'], ['💂', 'a royal guard'], ['🕵️', 'a detective'], ['👩‍⚕️', 'a doctor'],
      ['👩‍🍳', 'a chef'], ['👨‍🎤', 'a rock singer'], ['👩‍🚀', 'an astronaut'],
      ['👸', 'a princess'], ['🤴', 'a prince'], ['🦸', 'a superhero'], ['🧙', 'a wizard'], ['🎅', 'Santa Claus'], ['👰', 'a bride'],
      ['👁️', 'an eye'], ['👄', 'lips'], ['👋', 'a waving hand'], ['👍', 'a thumbs up'], ['💪', 'a flexed arm muscle'],
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    items: [
      ['🐶', 'a dog'], ['🐱', 'a cat'], ['🐭', 'a mouse'], ['🐹', 'a hamster'], ['🐰', 'a rabbit'], ['🐾', 'paw prints'],
      ['🦊', 'a fox'], ['🐻', 'a bear'], ['🐼', 'a panda'], ['🐨', 'a koala'], ['🐯', 'a tiger'], ['🦁', 'a lion'], ['🐵', 'a monkey'],
      ['🦍', 'a gorilla'], ['🦓', 'a zebra'], ['🦒', 'a giraffe'], ['🐘', 'an elephant'], ['🦏', 'a rhinoceros'], ['🐪', 'a camel'],
      ['🦌', 'a deer'], ['🐿️', 'a squirrel'], ['🦔', 'a hedgehog'], ['🦇', 'a bat'], ['🐺', 'a wolf'], ['🦝', 'a raccoon'], ['🦥', 'a sloth'],
      ['🦘', 'a kangaroo'],
      ['🐮', 'a cow'], ['🐷', 'a pig'], ['🐴', 'a horse'], ['🦄', 'a unicorn'], ['🐑', 'a sheep'], ['🐐', 'a goat'],
      ['🐦', 'a small songbird such as a robin or a sparrow'], ['🐦‍⬛', 'a black crow'], ['🕊️', 'a white dove'], ['🦅', 'an eagle'],
      ['🦉', 'an owl'], ['🦜', 'a parrot'], ['🦩', 'a flamingo'], ['🦚', 'a peacock'], ['🦢', 'a swan'], ['🦆', 'a duck'], ['🪿', 'a goose'],
      ['🐧', 'a penguin'], ['🐔', 'a chicken'], ['🐓', 'a rooster'], ['🦃', 'a turkey'], ['🐤', 'a baby chick'], ['🐣', 'a chick hatching from an egg'],
      ['🦤', 'a dodo'],
      ['🪶', 'a feather'], ['🪽', 'a bird wing'],
      ['🐸', 'a frog'], ['🐢', 'a turtle'], ['🐍', 'a snake'], ['🦎', 'a lizard'], ['🐊', 'a crocodile'], ['🦖', 'a dinosaur'], ['🐉', 'a dragon'],
      ['🐳', 'a whale'], ['🐬', 'a dolphin'], ['🦈', 'a shark'], ['🦭', 'a seal'], ['🐟', 'a fish'], ['🐠', 'a tropical fish'], ['🐙', 'an octopus'],
      ['🪼', 'a jellyfish'], ['🦀', 'a crab'], ['🦞', 'a lobster'],
      ['🐌', 'a snail'], ['🦋', 'a butterfly'], ['🐝', 'a bee'], ['🐞', 'a ladybug'], ['🕷️', 'a spider'], ['🐜', 'an ant'],
    ],
  },
  {
    id: 'food',
    label: 'Food & drink',
    items: [
      ['🍎', 'an apple'], ['🍌', 'a banana'], ['🍇', 'grapes'], ['🍓', 'a strawberry'], ['🍒', 'cherries'], ['🍑', 'a peach'],
      ['🍍', 'a pineapple'], ['🥥', 'a coconut'], ['🍉', 'a watermelon'], ['🍋', 'a lemon'], ['🍊', 'an orange'], ['🥑', 'an avocado'],
      ['🍅', 'a tomato'], ['🥕', 'a carrot'], ['🌽', 'corn'], ['🌶️', 'a chili pepper'], ['🥦', 'broccoli'], ['🍄', 'a mushroom'], ['🥔', 'a potato'],
      ['🍞', 'bread'], ['🥐', 'a croissant'], ['🥨', 'a pretzel'], ['🧀', 'cheese'], ['🥚', 'an egg'], ['🥓', 'bacon'], ['🍗', 'fried chicken'],
      ['🍖', 'meat on the bone'], ['🍔', 'a hamburger'], ['🍟', 'french fries'], ['🍕', 'pizza'], ['🌭', 'a hot dog'], ['🌮', 'a taco'],
      ['🌯', 'a burrito'], ['🥗', 'a salad'], ['🍝', 'spaghetti pasta'], ['🍜', 'a bowl of noodles'], ['🍣', 'sushi'], ['🍤', 'fried shrimp'],
      ['🥟', 'dumplings'], ['🍚', 'a bowl of rice'], ['🍛', 'curry'],
      ['🍦', 'ice cream'], ['🍩', 'a donut'], ['🍪', 'a cookie'], ['🎂', 'a birthday cake'], ['🧁', 'a cupcake'], ['🍫', 'chocolate'],
      ['🍬', 'candy'], ['🍭', 'a lollipop'], ['🍿', 'popcorn'],
      ['☕', 'a cup of coffee'], ['🍵', 'tea'], ['🍺', 'a glass of beer'], ['🍷', 'a glass of red wine'], ['🍸', 'a cocktail'],
      ['🥤', 'a soft drink'], ['🧃', 'a juice box'],
    ],
  },
  {
    id: 'nature',
    label: 'Nature & places',
    items: [
      ['🌸', 'cherry blossom flowers'], ['🌹', 'a rose'], ['🌻', 'a sunflower'], ['🌷', 'a tulip'],
      ['🌵', 'a cactus'], ['🌴', 'a palm tree'], ['🌲', 'an evergreen tree'], ['🌳', 'a tree'], ['🍁', 'autumn leaves'], ['🌿', 'green plants'],
      ['🍀', 'a four leaf clover'],
      ['🌊', 'ocean waves'], ['🏖️', 'a beach'], ['🏝️', 'a tropical island'], ['🏜️', 'a desert'], ['🏔️', 'snowy mountains'], ['⛰️', 'a mountain'],
      ['🌋', 'a volcano'], ['🏕️', 'a campsite'], ['🌅', 'a sunset over the sea'], ['🌄', 'a sunrise over mountains'], ['🏞️', 'a national park with a river'],
      ['🌈', 'a rainbow'], ['☀️', 'the sun'], ['🌙', 'the moon'], ['⭐', 'stars'], ['🌌', 'the milky way'], ['☁️', 'clouds'], ['⛈️', 'a thunderstorm'],
      ['❄️', 'snow'], ['☃️', 'a snowman'], ['🔥', 'fire'], ['💧', 'water drops'], ['🌍', 'the earth'],
      ['🌃', 'a city at night'], ['🏙️', 'a city skyline'], ['🌉', 'a bridge at night'], ['🌁', 'a foggy bridge'], ['🏢', 'an office building'],
      ['🏭', 'a factory'], ['🏟️', 'a stadium'], ['🎡', 'a ferris wheel'], ['🎢', 'a roller coaster'],
      ['🏠', 'a house'], ['🏡', 'a house with a garden'], ['🏰', 'a castle'], ['🏯', 'a Japanese castle'], ['⛪', 'a church'], ['🕌', 'a mosque'],
      ['🛕', 'a temple'], ['⛩️', 'a shrine gate'], ['🏛️', 'a classical building with columns'], ['🗼', 'a tower'], ['🗽', 'a statue'],
      ['🗿', 'a stone head statue'], ['⛲', 'a fountain'],
    ],
  },
  {
    id: 'travel',
    label: 'Travel & activities',
    items: [
      ['🚗', 'a car'], ['🏎️', 'a race car'], ['🚕', 'a taxi'], ['🚌', 'a bus'], ['🚓', 'a police car'], ['🚑', 'an ambulance'], ['🚒', 'a fire truck'],
      ['🚚', 'a truck'], ['🚜', 'a tractor'], ['🏍️', 'a motorcycle'], ['🚲', 'a bicycle'], ['🛴', 'a scooter'], ['🚦', 'a traffic light'], ['⛽', 'a gas pump'],
      ['🚂', 'a steam locomotive'], ['🚆', 'a train'], ['🚇', 'a subway'],
      ['✈️', 'an airplane'], ['🚁', 'a helicopter'], ['🚀', 'a rocket'], ['🛸', 'a flying saucer'],
      ['⛵', 'a sailboat'], ['🚢', 'a ship'], ['⚓', 'an anchor'],
      ['⚽', 'a soccer ball'], ['🏀', 'a basketball'], ['🏈', 'an american football'], ['⚾', 'a baseball'], ['🎾', 'a tennis ball'],
      ['🏐', 'a volleyball'], ['🏉', 'a rugby ball'], ['🎱', 'a pool ball'], ['🏓', 'ping pong'], ['🏸', 'badminton'], ['⛳', 'golf'],
      ['🥊', 'boxing gloves'], ['⛷️', 'skiing'], ['🏂', 'snowboarding'], ['🏄', 'surfing'], ['🏊', 'swimming'], ['🚴', 'cycling'],
      ['🧗', 'rock climbing'], ['🏆', 'a trophy'], ['🥇', 'a gold medal'],
      ['🎮', 'a video game controller'], ['🎲', 'dice'], ['♟️', 'chess'], ['🧩', 'a jigsaw puzzle'],
      ['🎨', 'a painting palette'], ['🎭', 'theatre masks'], ['🎬', 'a movie clapperboard'], ['🎪', 'a circus tent'],
      ['🎤', 'a microphone'], ['🎧', 'headphones'], ['🎸', 'a guitar'], ['🎹', 'a piano'], ['🥁', 'a drum'], ['🎺', 'a trumpet'], ['🎻', 'a violin'],
      ['🎆', 'fireworks'], ['🎈', 'balloons'], ['🎉', 'a party popper'], ['🎁', 'a gift box'], ['🎄', 'a christmas tree'],
      ['🎃', 'a jack-o-lantern pumpkin'],
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    items: [
      ['📱', 'a mobile phone'], ['💻', 'a laptop'], ['🖥️', 'a computer'], ['⌨️', 'a keyboard'], ['🖱️', 'a computer mouse'], ['📷', 'a camera'],
      ['📺', 'a television'], ['📻', 'a radio'], ['☎️', 'a telephone'], ['⏰', 'an alarm clock'], ['⌚', 'a watch'],
      ['💡', 'a light bulb'], ['🔦', 'a flashlight'], ['🕯️', 'a candle'],
      ['💰', 'a bag of money'], ['💵', 'banknotes'], ['💎', 'a diamond'], ['💍', 'a ring'], ['👑', 'a crown'],
      ['🎩', 'a top hat'], ['🧢', 'a cap'], ['👓', 'glasses'], ['👕', 'a t-shirt'], ['👗', 'a dress'], ['👟', 'a sneaker'], ['👠', 'a high heel shoe'],
      ['👜', 'a handbag'], ['🎒', 'a backpack'], ['☂️', 'an umbrella'],
      ['🔑', 'a key'], ['🔒', 'a padlock'], ['🔨', 'a hammer'], ['🔧', 'a wrench'], ['⚙️', 'a gear'], ['🧲', 'a magnet'], ['✂️', 'scissors'], ['📎', 'a paperclip'],
      ['⚔️', 'swords'], ['🛡️', 'a shield'], ['🔫', 'a water pistol'], ['💣', 'a bomb'], ['🧨', 'a firecracker'],
      ['🔭', 'a telescope'], ['🔬', 'a microscope'], ['💊', 'a pill'], ['💉', 'a syringe'],
      ['📚', 'books'], ['📖', 'an open book'], ['✏️', 'a pencil'], ['🖊️', 'a pen'], ['📦', 'a cardboard box'], ['✉️', 'an envelope'], ['🗺️', 'a map'],
      ['🧭', 'a compass'], ['🖼️', 'a framed picture'], ['🧸', 'a teddy bear'], ['🪁', 'a kite'],
      ['🪑', 'a chair'], ['🛏️', 'a bed'], ['🛁', 'a bathtub'], ['🚽', 'a toilet'], ['🧻', 'toilet paper'], ['🧼', 'soap'], ['🪴', 'a potted plant'],
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols & shapes',
    items: [
      ['❤️', 'a red heart'], ['🧡', 'an orange heart'], ['💛', 'a yellow heart'], ['💚', 'a green heart'], ['💙', 'a blue heart'],
      ['💜', 'a purple heart'], ['🖤', 'a black heart'], ['💔', 'a broken heart'],
      ['💯', 'one hundred points'], ['💥', 'an explosion'], ['💫', 'dizzy stars'], ['✨', 'sparkles'], ['💤', 'zzz sleep'], ['💬', 'a speech bubble'],
      ['❓', 'a question mark'], ['❗', 'an exclamation mark'], ['⚠️', 'a warning sign'], ['🚫', 'a prohibited sign'], ['♻️', 'a recycling symbol'],
      ['☮️', 'a peace symbol'], ['☯️', 'yin and yang'], ['🎵', 'a musical note'], ['💲', 'a dollar sign'], ['🔆', 'brightness'], ['🌀', 'a cyclone spiral'],
      ['🔴', 'a red circle'], ['🟠', 'an orange circle'], ['🟡', 'a yellow circle'], ['🟢', 'a green circle'], ['🔵', 'a blue circle'],
      ['🟣', 'a purple circle'], ['⚫', 'a black circle'], ['⚪', 'a white circle'], ['🟥', 'a red square'], ['🟦', 'a blue square'],
      ['🟩', 'a green square'], ['🟨', 'a yellow square'], ['⬛', 'a black square'], ['🔺', 'a red triangle'], ['🔷', 'a blue diamond'],
      ['💠', 'a diamond shape with a dot'],
      ['♠️', 'spades'], ['♥️', 'hearts suit'], ['🃏', 'a joker card'], ['🀄', 'a mahjong tile'],
    ],
  },
];

/** Every palette emoji with its description and category, in a fixed order. */
export const EMOJI_VOCAB = EMOJI_PALETTE.flatMap((group) => group.items.map(([emoji, name]) => ({ emoji, name, group: group.id })));

/**
 * The PictureGame Discord server's emojis, written `:name:` (raster/emojiArt.js draws them). They
 * are in the emoji picker but not in EMOJI_VOCAB: "From the picture" has no descriptions for them.
 */
export const SERVER_EMOJIS = DISCORD_EMOJIS.map((emoji) => `:${emoji.name}:`);

/** `count` different PictureGame server emojis. */
export function randomServerEmojis(count = 4 + Math.floor(Math.random() * 3)) {
  return [...SERVER_EMOJIS].sort(() => Math.random() - 0.5).slice(0, count);
}

/** Ready-made sets shown in Masks → Other. `null` emojis means "pick at random" (with `random`). */
export const EMOJI_SETS = [
  { id: 'random', name: 'Random', emojis: null },
  ...(SERVER_EMOJIS.length ? [{ id: 'picturegame', name: 'PictureGame', emojis: null, preview: SERVER_EMOJIS.slice(0, 6), random: randomServerEmojis }] : []),
  { id: 'faces', name: 'Faces', emojis: ['😀', '😂', '😎', '🤔', '😱', '🥳'] },
  { id: 'animals', name: 'Animals', emojis: ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁'] },
  { id: 'fruit', name: 'Fruit', emojis: ['🍎', '🍌', '🍇', '🍓', '🍉', '🍍'] },
  { id: 'nature', name: 'Nature', emojis: ['🌸', '🌻', '🌳', '🍁', '🌵', '🍄'] },
  { id: 'sports', name: 'Sports', emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐'] },
  { id: 'blobs', name: 'Google blobs', emojis: ['😀', '😂', '😍', '🤔', '😎', '🥳'], style: 2 },
];

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const SERVER_SET = new Set(SERVER_EMOJIS);

/** The same emoji, with or without the FE0F that asks for the colour version. */
export function sameEmoji(a, b) {
  return a === b || a.replace(/\ufe0f/g, '') === b.replace(/\ufe0f/g, '');
}

/** The emojis in a piece of text, in order, without repeats (at most 40). `:name:` is a server emoji. */
export function splitEmojis(text) {
  const found = [];

  for (const piece of String(text ?? '').split(/(:[\w~-]{2,32}:)/)) {
    if (SERVER_SET.has(piece)) {
      found.push(piece);
      continue;
    }

    const graphemes = segmenter ? [...segmenter.segment(piece)].map((part) => part.segment) : [...piece];

    found.push(...graphemes.filter((part) => PICTOGRAPHIC.test(part)));
  }

  return [...new Set(found)].slice(0, 40);
}

/** `count` different emojis, mostly from one palette group so the result looks like a theme. */
export function randomEmojis(count = 2 + Math.floor(Math.random() * 4)) {
  const group = EMOJI_PALETTE[Math.floor(Math.random() * EMOJI_PALETTE.length)];
  const pool = [...group.items.map(([emoji]) => emoji)];
  const picked = [];

  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  return picked;
}
