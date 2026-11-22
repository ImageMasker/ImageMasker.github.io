// Emoji masks: the emoji palette, ready-made sets and the slider definition.
//
// Each palette entry has a short English description. The descriptions are what the optional
// "From the picture" detector compares the picture with (see dev/emoji-embeddings.html, which
// turns them into src/masks/emojiEmbeddings.json), so describe what the emoji shows in a photo.
// Adding, removing or rewording entries needs that file to be regenerated.

const R = (key, label, min, max, value, step = 1) => ({ key, label, type: 'range', min, max, value, step });

/** Sliders of an emoji mask (normalised like effect and pattern params). */
export const EMOJI_MASK = {
  id: 'emoji',
  name: 'Emoji',
  params: [
    { key: 'style', label: 'Emoji style', type: 'select', options: ['Twemoji', 'This device'], value: 0 },
    R('density', 'Density', 2, 40, 9),
    R('size', 'Emoji size', 20, 400, 95),
    R('variety', 'Size variety', 0, 100, 35),
    R('turn', 'Rotation', 0, 180, 25),
    R('scatter', 'Scatter', 0, 100, 55),
    { key: 'bg', label: 'Background', type: 'color', value: '#f4efe6' },
    R('bgAlpha', 'Background opacity', 0, 100, 0),
  ],
};

// Entries are [emoji, description, theme, part]. A theme is a set of emojis that belong together
// (birds, fruit, vehicles…): "From the picture" picks its emojis from the theme the picture matches
// best, so a robin gets other birds rather than an orange for its breast. `part` entries (a
// feather) count towards their theme but are picked last.
const T = (theme, items, { part = false } = {}) => items.map(([emoji, name]) => [emoji, name, theme, part]);

export const EMOJI_PALETTE = [
  {
    id: 'faces',
    label: 'Faces & people',
    items: [
      ...T('face', [
        ['😀', 'a smiling face'], ['😂', 'a laughing face with tears'], ['😍', 'a face with heart eyes'], ['😎', 'a face with sunglasses'],
        ['🤔', 'a thinking face'], ['😴', 'a sleeping face'], ['😱', 'a screaming scared face'], ['🤯', 'a mind blown face'], ['🥳', 'a party face'],
      ]),
      ...T('creature', [
        ['🤡', 'a clown'], ['👻', 'a ghost'], ['💀', 'a skull'], ['👽', 'an alien'], ['🤖', 'a robot'], ['🧛', 'a vampire'], ['🧟', 'a zombie'],
        ['🐦‍🔥', 'a phoenix'],
      ]),
      ...T('person', [
        ['👶', 'a baby'], ['👧', 'a girl'], ['👦', 'a boy'], ['👩', 'a woman'], ['👨', 'a man'], ['👵', 'an old woman'], ['👴', 'an old man'],
        ['💃', 'a woman dancing'], ['🏃', 'a person running'], ['🧘', 'a person doing yoga'], ['👥', 'a crowd of people'],
      ]),
      ...T('job', [
        ['👮', 'a police officer'], ['👷', 'a construction worker'], ['💂', 'a royal guard'], ['🕵️', 'a detective'], ['👩‍⚕️', 'a doctor'],
        ['👩‍🍳', 'a chef'], ['👨‍🎤', 'a rock singer'], ['👩‍🚀', 'an astronaut'],
      ]),
      ...T('character', [['👸', 'a princess'], ['🤴', 'a prince'], ['🦸', 'a superhero'], ['🧙', 'a wizard'], ['🎅', 'Santa Claus'], ['👰', 'a bride']]),
      ...T('body', [['👁️', 'an eye'], ['👄', 'lips'], ['👋', 'a waving hand'], ['👍', 'a thumbs up'], ['💪', 'a flexed arm muscle']]),
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    items: [
      ...T('pet', [['🐶', 'a dog'], ['🐱', 'a cat'], ['🐭', 'a mouse'], ['🐹', 'a hamster'], ['🐰', 'a rabbit'], ['🐾', 'paw prints']]),
      ...T('wild', [
        ['🦊', 'a fox'], ['🐻', 'a bear'], ['🐼', 'a panda'], ['🐨', 'a koala'], ['🐯', 'a tiger'], ['🦁', 'a lion'], ['🐵', 'a monkey'],
        ['🦍', 'a gorilla'], ['🦓', 'a zebra'], ['🦒', 'a giraffe'], ['🐘', 'an elephant'], ['🦏', 'a rhinoceros'], ['🐪', 'a camel'],
        ['🦌', 'a deer'], ['🐿️', 'a squirrel'], ['🦔', 'a hedgehog'], ['🦇', 'a bat'], ['🐺', 'a wolf'], ['🦝', 'a raccoon'], ['🦥', 'a sloth'],
        ['🦘', 'a kangaroo'],
      ]),
      ...T('farm', [['🐮', 'a cow'], ['🐷', 'a pig'], ['🐴', 'a horse'], ['🦄', 'a unicorn'], ['🐑', 'a sheep'], ['🐐', 'a goat']]),
      ...T('bird', [
        ['🐦', 'a small songbird such as a robin or a sparrow'], ['🐦‍⬛', 'a black crow'], ['🕊️', 'a white dove'], ['🦅', 'an eagle'],
        ['🦉', 'an owl'], ['🦜', 'a parrot'], ['🦩', 'a flamingo'], ['🦚', 'a peacock'], ['🦢', 'a swan'], ['🦆', 'a duck'], ['🪿', 'a goose'],
        ['🐧', 'a penguin'], ['🐔', 'a chicken'], ['🐓', 'a rooster'], ['🦃', 'a turkey'], ['🐤', 'a baby chick'], ['🐣', 'a chick hatching from an egg'],
        ['🦤', 'a dodo'],
      ]),
      // Parts of a bird: they count towards "this is a bird" but are only picked after real birds.
      ...T('bird', [['🪶', 'a feather'], ['🪽', 'a bird wing']], { part: true }),
      ...T('reptile', [['🐸', 'a frog'], ['🐢', 'a turtle'], ['🐍', 'a snake'], ['🦎', 'a lizard'], ['🐊', 'a crocodile'], ['🦖', 'a dinosaur'], ['🐉', 'a dragon']]),
      ...T('sea', [
        ['🐳', 'a whale'], ['🐬', 'a dolphin'], ['🦈', 'a shark'], ['🦭', 'a seal'], ['🐟', 'a fish'], ['🐠', 'a tropical fish'], ['🐙', 'an octopus'],
        ['🪼', 'a jellyfish'], ['🦀', 'a crab'], ['🦞', 'a lobster'],
      ]),
      ...T('bug', [['🐌', 'a snail'], ['🦋', 'a butterfly'], ['🐝', 'a bee'], ['🐞', 'a ladybug'], ['🕷️', 'a spider'], ['🐜', 'an ant']]),
    ],
  },
  {
    id: 'food',
    label: 'Food & drink',
    items: [
      ...T('fruit', [
        ['🍎', 'an apple'], ['🍌', 'a banana'], ['🍇', 'grapes'], ['🍓', 'a strawberry'], ['🍒', 'cherries'], ['🍑', 'a peach'],
        ['🍍', 'a pineapple'], ['🥥', 'a coconut'], ['🍉', 'a watermelon'], ['🍋', 'a lemon'], ['🍊', 'an orange'], ['🥑', 'an avocado'],
      ]),
      ...T('vegetable', [['🍅', 'a tomato'], ['🥕', 'a carrot'], ['🌽', 'corn'], ['🌶️', 'a chili pepper'], ['🥦', 'broccoli'], ['🍄', 'a mushroom'], ['🥔', 'a potato']]),
      ...T('meal', [
        ['🍞', 'bread'], ['🥐', 'a croissant'], ['🥨', 'a pretzel'], ['🧀', 'cheese'], ['🥚', 'an egg'], ['🥓', 'bacon'], ['🍗', 'fried chicken'],
        ['🍖', 'meat on the bone'], ['🍔', 'a hamburger'], ['🍟', 'french fries'], ['🍕', 'pizza'], ['🌭', 'a hot dog'], ['🌮', 'a taco'],
        ['🌯', 'a burrito'], ['🥗', 'a salad'], ['🍝', 'spaghetti pasta'], ['🍜', 'a bowl of noodles'], ['🍣', 'sushi'], ['🍤', 'fried shrimp'],
        ['🥟', 'dumplings'], ['🍚', 'a bowl of rice'], ['🍛', 'curry'],
      ]),
      ...T('sweet', [
        ['🍦', 'ice cream'], ['🍩', 'a donut'], ['🍪', 'a cookie'], ['🎂', 'a birthday cake'], ['🧁', 'a cupcake'], ['🍫', 'chocolate'],
        ['🍬', 'candy'], ['🍭', 'a lollipop'], ['🍿', 'popcorn'],
      ]),
      ...T('drink', [
        ['☕', 'a cup of coffee'], ['🍵', 'tea'], ['🍺', 'a glass of beer'], ['🍷', 'a glass of red wine'], ['🍸', 'a cocktail'],
        ['🥤', 'a soft drink'], ['🧃', 'a juice box'],
      ]),
    ],
  },
  {
    id: 'nature',
    label: 'Nature & places',
    items: [
      ...T('flower', [['🌸', 'cherry blossom flowers'], ['🌹', 'a rose'], ['🌻', 'a sunflower'], ['🌷', 'a tulip']]),
      ...T('plant', [
        ['🌵', 'a cactus'], ['🌴', 'a palm tree'], ['🌲', 'an evergreen tree'], ['🌳', 'a tree'], ['🍁', 'autumn leaves'], ['🌿', 'green plants'],
        ['🍀', 'a four leaf clover'],
      ]),
      ...T('landscape', [
        ['🌊', 'ocean waves'], ['🏖️', 'a beach'], ['🏝️', 'a tropical island'], ['🏜️', 'a desert'], ['🏔️', 'snowy mountains'], ['⛰️', 'a mountain'],
        ['🌋', 'a volcano'], ['🏕️', 'a campsite'], ['🌅', 'a sunset over the sea'], ['🌄', 'a sunrise over mountains'], ['🏞️', 'a national park with a river'],
      ]),
      ...T('sky', [
        ['🌈', 'a rainbow'], ['☀️', 'the sun'], ['🌙', 'the moon'], ['⭐', 'stars'], ['🌌', 'the milky way'], ['☁️', 'clouds'], ['⛈️', 'a thunderstorm'],
        ['❄️', 'snow'], ['☃️', 'a snowman'], ['🔥', 'fire'], ['💧', 'water drops'], ['🌍', 'the earth'],
      ]),
      ...T('city', [
        ['🌃', 'a city at night'], ['🏙️', 'a city skyline'], ['🌉', 'a bridge at night'], ['🌁', 'a foggy bridge'], ['🏢', 'an office building'],
        ['🏭', 'a factory'], ['🏟️', 'a stadium'], ['🎡', 'a ferris wheel'], ['🎢', 'a roller coaster'],
      ]),
      ...T('building', [
        ['🏠', 'a house'], ['🏡', 'a house with a garden'], ['🏰', 'a castle'], ['🏯', 'a Japanese castle'], ['⛪', 'a church'], ['🕌', 'a mosque'],
        ['🛕', 'a temple'], ['⛩️', 'a shrine gate'], ['🏛️', 'a classical building with columns'], ['🗼', 'a tower'], ['🗽', 'a statue'],
        ['🗿', 'a stone head statue'], ['⛲', 'a fountain'],
      ]),
    ],
  },
  {
    id: 'travel',
    label: 'Travel & activities',
    items: [
      ...T('road', [
        ['🚗', 'a car'], ['🏎️', 'a race car'], ['🚕', 'a taxi'], ['🚌', 'a bus'], ['🚓', 'a police car'], ['🚑', 'an ambulance'], ['🚒', 'a fire truck'],
        ['🚚', 'a truck'], ['🚜', 'a tractor'], ['🏍️', 'a motorcycle'], ['🚲', 'a bicycle'], ['🛴', 'a scooter'], ['🚦', 'a traffic light'], ['⛽', 'a gas pump'],
      ]),
      ...T('rail', [['🚂', 'a steam locomotive'], ['🚆', 'a train'], ['🚇', 'a subway']]),
      ...T('air', [['✈️', 'an airplane'], ['🚁', 'a helicopter'], ['🚀', 'a rocket'], ['🛸', 'a flying saucer']]),
      ...T('boat', [['⛵', 'a sailboat'], ['🚢', 'a ship'], ['⚓', 'an anchor']]),
      ...T('ball', [
        ['⚽', 'a soccer ball'], ['🏀', 'a basketball'], ['🏈', 'an american football'], ['⚾', 'a baseball'], ['🎾', 'a tennis ball'],
        ['🏐', 'a volleyball'], ['🏉', 'a rugby ball'], ['🎱', 'a pool ball'], ['🏓', 'ping pong'], ['🏸', 'badminton'], ['⛳', 'golf'],
      ]),
      ...T('sport', [
        ['🥊', 'boxing gloves'], ['⛷️', 'skiing'], ['🏂', 'snowboarding'], ['🏄', 'surfing'], ['🏊', 'swimming'], ['🚴', 'cycling'],
        ['🧗', 'rock climbing'], ['🏆', 'a trophy'], ['🥇', 'a gold medal'],
      ]),
      ...T('game', [['🎮', 'a video game controller'], ['🎲', 'dice'], ['♟️', 'chess'], ['🧩', 'a jigsaw puzzle']]),
      ...T('show', [['🎨', 'a painting palette'], ['🎭', 'theatre masks'], ['🎬', 'a movie clapperboard'], ['🎪', 'a circus tent']]),
      ...T('music', [['🎤', 'a microphone'], ['🎧', 'headphones'], ['🎸', 'a guitar'], ['🎹', 'a piano'], ['🥁', 'a drum'], ['🎺', 'a trumpet'], ['🎻', 'a violin']]),
      ...T('party', [
        ['🎆', 'fireworks'], ['🎈', 'balloons'], ['🎉', 'a party popper'], ['🎁', 'a gift box'], ['🎄', 'a christmas tree'],
        ['🎃', 'a jack-o-lantern pumpkin'],
      ]),
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    items: [
      ...T('tech', [
        ['📱', 'a mobile phone'], ['💻', 'a laptop'], ['🖥️', 'a computer'], ['⌨️', 'a keyboard'], ['🖱️', 'a computer mouse'], ['📷', 'a camera'],
        ['📺', 'a television'], ['📻', 'a radio'], ['☎️', 'a telephone'], ['⏰', 'an alarm clock'], ['⌚', 'a watch'],
      ]),
      ...T('light', [['💡', 'a light bulb'], ['🔦', 'a flashlight'], ['🕯️', 'a candle']]),
      ...T('treasure', [['💰', 'a bag of money'], ['💵', 'banknotes'], ['💎', 'a diamond'], ['💍', 'a ring'], ['👑', 'a crown']]),
      ...T('clothes', [
        ['🎩', 'a top hat'], ['🧢', 'a cap'], ['👓', 'glasses'], ['👕', 'a t-shirt'], ['👗', 'a dress'], ['👟', 'a sneaker'], ['👠', 'a high heel shoe'],
        ['👜', 'a handbag'], ['🎒', 'a backpack'], ['☂️', 'an umbrella'],
      ]),
      ...T('tool', [['🔑', 'a key'], ['🔒', 'a padlock'], ['🔨', 'a hammer'], ['🔧', 'a wrench'], ['⚙️', 'a gear'], ['🧲', 'a magnet'], ['✂️', 'scissors'], ['📎', 'a paperclip']]),
      ...T('weapon', [['⚔️', 'swords'], ['🛡️', 'a shield'], ['🔫', 'a water pistol'], ['💣', 'a bomb'], ['🧨', 'a firecracker']]),
      ...T('science', [['🔭', 'a telescope'], ['🔬', 'a microscope'], ['💊', 'a pill'], ['💉', 'a syringe']]),
      ...T('paper', [
        ['📚', 'books'], ['📖', 'an open book'], ['✏️', 'a pencil'], ['🖊️', 'a pen'], ['📦', 'a cardboard box'], ['✉️', 'an envelope'], ['🗺️', 'a map'],
        ['🧭', 'a compass'], ['🖼️', 'a framed picture'], ['🧸', 'a teddy bear'], ['🪁', 'a kite'],
      ]),
      ...T('home', [['🪑', 'a chair'], ['🛏️', 'a bed'], ['🛁', 'a bathtub'], ['🚽', 'a toilet'], ['🧻', 'toilet paper'], ['🧼', 'soap'], ['🪴', 'a potted plant']]),
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols & shapes',
    items: [
      ...T('heart', [
        ['❤️', 'a red heart'], ['🧡', 'an orange heart'], ['💛', 'a yellow heart'], ['💚', 'a green heart'], ['💙', 'a blue heart'],
        ['💜', 'a purple heart'], ['🖤', 'a black heart'], ['💔', 'a broken heart'],
      ]),
      ...T('symbol', [
        ['💯', 'one hundred points'], ['💥', 'an explosion'], ['💫', 'dizzy stars'], ['✨', 'sparkles'], ['💤', 'zzz sleep'], ['💬', 'a speech bubble'],
        ['❓', 'a question mark'], ['❗', 'an exclamation mark'], ['⚠️', 'a warning sign'], ['🚫', 'a prohibited sign'], ['♻️', 'a recycling symbol'],
        ['☮️', 'a peace symbol'], ['☯️', 'yin and yang'], ['🎵', 'a musical note'], ['💲', 'a dollar sign'], ['🔆', 'brightness'], ['🌀', 'a cyclone spiral'],
      ]),
      ...T('shape', [
        ['🔴', 'a red circle'], ['🟠', 'an orange circle'], ['🟡', 'a yellow circle'], ['🟢', 'a green circle'], ['🔵', 'a blue circle'],
        ['🟣', 'a purple circle'], ['⚫', 'a black circle'], ['⚪', 'a white circle'], ['🟥', 'a red square'], ['🟦', 'a blue square'],
        ['🟩', 'a green square'], ['🟨', 'a yellow square'], ['⬛', 'a black square'], ['🔺', 'a red triangle'], ['🔷', 'a blue diamond'],
        ['💠', 'a diamond shape with a dot'],
      ]),
      ...T('card', [['♠️', 'spades'], ['♥️', 'hearts suit'], ['🃏', 'a joker card'], ['🀄', 'a mahjong tile']]),
    ],
  },
];

/** Every palette emoji with its description, category and theme, in a fixed order. */
export const EMOJI_VOCAB = EMOJI_PALETTE.flatMap((group) => group.items.map(([emoji, name, theme, part]) => ({ emoji, name, group: group.id, theme, part })));

/** Ready-made sets shown in Masks → Other. `null` emojis means "pick at random". */
export const EMOJI_SETS = [
  { id: 'random', name: 'Random', emojis: null },
  { id: 'faces', name: 'Faces', emojis: ['😀', '😂', '😎', '🤔', '😱', '🥳'] },
  { id: 'animals', name: 'Animals', emojis: ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁'] },
  { id: 'food', name: 'Food', emojis: ['🍕', '🍔', '🍟', '🌮', '🍩', '🍣'] },
  { id: 'fruit', name: 'Fruit', emojis: ['🍎', '🍌', '🍇', '🍓', '🍉', '🍍'] },
  { id: 'nature', name: 'Nature', emojis: ['🌸', '🌻', '🌳', '🍁', '🌵', '🍄'] },
  { id: 'space', name: 'Space', emojis: ['🚀', '🌙', '⭐', '🪐', '🛸', '☄️'] },
  { id: 'hearts', name: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜'] },
  { id: 'sports', name: 'Sports', emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐'] },
  { id: 'party', name: 'Party', emojis: ['🎉', '🎈', '🎁', '🎂', '✨', '🥳'] },
  { id: 'spooky', name: 'Spooky', emojis: ['👻', '💀', '🎃', '🕷️', '🦇', '🧟'] },
  { id: 'shapes', name: 'Shapes', emojis: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'] },
];

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** The emojis in a piece of text, in order, without repeats (at most 40). */
export function splitEmojis(text) {
  const graphemes = segmenter ? [...segmenter.segment(String(text ?? ''))].map((part) => part.segment) : [...String(text ?? '')];

  return [...new Set(graphemes.filter((part) => PICTOGRAPHIC.test(part)))].slice(0, 40);
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
