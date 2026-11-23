// More emojis that "From the picture" can choose, on top of the palette (emojiData.js): animals,
// food, places, vehicles, objects and people from the full Unicode list, so a horse can also get
// 🐎 🏇 and a goat 🐐 🐏 instead of whatever else the palette has nearby. They are not in the
// palette shown in the editor; the emoji picker has them under the full list.
//
// Describe what the emoji shows as it would look in a photo ("a caterpillar", not "a bug"): the
// picture model compares the picture with these words. Adding, removing or rewording entries
// means regenerating src/masks/emojiEmbeddings.json with dev/emoji-embeddings.html.

import { EMOJI_VOCAB } from './emojiData.js';

const PICTURE_EMOJIS = [
  // People
  ['🧒', 'a child'], ['🧑', 'a person'], ['👱', 'a person with blond hair'], ['🧔', 'a man with a beard'], ['🧑‍🦰', 'a person with red hair'],
  ['🧑‍🦱', 'a person with curly hair'], ['🧑‍🦳', 'a person with white hair'], ['🧑‍🦲', 'a bald person'], ['🧓', 'an elderly person'],
  ['🧑‍⚕️', 'a doctor or nurse'], ['🧑‍🎓', 'a graduate in cap and gown'], ['🧑‍🏫', 'a teacher in a classroom'], ['🧑‍⚖️', 'a judge'],
  ['🧑‍🌾', 'a farmer'], ['🧑‍🍳', 'a cook'], ['🧑‍🔧', 'a mechanic'], ['🧑‍🏭', 'a factory worker'], ['🧑‍💼', 'an office worker'],
  ['🧑‍🔬', 'a scientist'], ['🧑‍💻', 'a person working on a laptop'], ['🧑‍🎤', 'a singer'], ['🧑‍🎨', 'an artist painting'], ['🧑‍✈️', 'a pilot'],
  ['🧑‍🚀', 'an astronaut'], ['🧑‍🚒', 'a firefighter'], ['🥷', 'a ninja'], ['🫅', 'a king with a crown'], ['👳', 'a man wearing a turban'],
  ['🤵', 'a man in a tuxedo'], ['🤰', 'a pregnant woman'], ['🧑‍🍼', 'a person feeding a baby'], ['👼', 'a cherub angel'], ['🦹', 'a supervillain'],
  ['🧚', 'a fairy'], ['🧜‍♀️', 'a mermaid'], ['🧝', 'an elf'], ['🧞', 'a genie'], ['🧌', 'a troll'], ['🫈', 'a hairy creature like bigfoot'],
  ['💆', 'a person getting a massage'], ['💇', 'a person getting a haircut'], ['🚶', 'a person walking'], ['🧑‍🦯', 'a blind person with a white cane'],
  ['🧑‍🦽', 'a person in a wheelchair'], ['🧑‍🩰', 'a ballet dancer'], ['🧖', 'a person in a sauna'], ['🤺', 'fencing'],
  ['🏇', 'a jockey riding a racehorse'], ['🏌️', 'a golfer'], ['🚣', 'people rowing a boat'], ['⛹️', 'a basketball player'], ['🏋️', 'a weightlifter'],
  ['🚵', 'a mountain biker'], ['🤸', 'a gymnast doing a cartwheel'], ['🤼', 'wrestlers'], ['🤽', 'water polo'], ['🤾', 'handball'], ['🤹', 'a juggler'],
  ['🛀', 'a person in a bathtub'], ['🛌', 'a person sleeping in bed'],

  // Animals
  ['🐒', 'a monkey'], ['🦧', 'an orangutan'], ['🐕', 'a dog'], ['🦮', 'a guide dog'], ['🐩', 'a poodle'], ['🐈', 'a cat'], ['🐈‍⬛', 'a black cat'],
  ['🐅', 'a tiger'], ['🐆', 'a leopard'], ['🫎', 'a moose'], ['🫏', 'a donkey'], ['🐎', 'a horse'], ['🦬', 'a bison'], ['🐂', 'an ox'],
  ['🐃', 'a water buffalo'], ['🐄', 'a cow'], ['🐖', 'a pig'], ['🐗', 'a wild boar'], ['🐏', 'a ram'], ['🐫', 'a bactrian camel'], ['🦙', 'a llama'],
  ['🦣', 'a mammoth'], ['🦛', 'a hippopotamus'], ['🐁', 'a mouse'], ['🐀', 'a rat'], ['🐇', 'a rabbit'], ['🦫', 'a beaver'], ['🐻‍❄️', 'a polar bear'],
  ['🦦', 'an otter'], ['🦨', 'a skunk'], ['🦡', 'a badger'], ['🐥', 'a baby chick'], ['🦕', 'a long-necked dinosaur'], ['🐋', 'a humpback whale'],
  ['🫍', 'an orca'], ['🐡', 'a pufferfish'], ['🐚', 'a seashell'], ['🪸', 'coral'], ['🦐', 'a shrimp'], ['🦑', 'a squid'], ['🦪', 'an oyster'],
  ['🐛', 'a caterpillar'], ['🪲', 'a beetle'], ['🦗', 'a grasshopper'], ['🪳', 'a cockroach'], ['🕸️', 'a spider web'], ['🦂', 'a scorpion'],
  ['🦟', 'a mosquito'], ['🪰', 'a fly'], ['🪱', 'an earthworm'], ['🦠', 'bacteria under a microscope'],

  // Plants
  ['💐', 'a bouquet of flowers'], ['🪷', 'a lotus flower'], ['🥀', 'a wilted rose'], ['🌺', 'a hibiscus flower'], ['🌼', 'a daisy'],
  ['🪻', 'hyacinth flowers'], ['🌱', 'a seedling'], ['🌾', 'ears of wheat'], ['🍂', 'fallen autumn leaves'], ['🍃', 'green leaves'],
  ['🪹', 'an empty bird nest'], ['🪺', 'a bird nest with eggs'], ['🪾', 'a bare tree in winter'],

  // Food and drink
  ['🍈', 'a melon'], ['🍋‍🟩', 'a lime'], ['🥭', 'a mango'], ['🍏', 'a green apple'], ['🍐', 'a pear'], ['🫐', 'blueberries'], ['🥝', 'a kiwi fruit'],
  ['🫒', 'olives'], ['🍆', 'an eggplant'], ['🫑', 'a bell pepper'], ['🥒', 'a cucumber'], ['🥬', 'lettuce'], ['🧄', 'garlic'], ['🧅', 'an onion'],
  ['🥜', 'peanuts'], ['🫘', 'beans'], ['🌰', 'a chestnut'], ['🫚', 'ginger root'], ['🫛', 'pea pods'], ['🍄‍🟫', 'brown mushrooms'],
  ['🥖', 'a baguette'], ['🫓', 'flatbread'], ['🥯', 'a bagel'], ['🥞', 'pancakes'], ['🧇', 'a waffle'], ['🥩', 'a raw steak'], ['🥪', 'a sandwich'],
  ['🫔', 'a tamale'], ['🥙', 'a kebab wrap'], ['🧆', 'falafel'], ['🍳', 'a fried egg in a frying pan'], ['🥘', 'paella in a pan'],
  ['🍲', 'a pot of stew'], ['🫕', 'fondue'], ['🥣', 'a bowl of cereal'], ['🧈', 'butter'], ['🧂', 'a salt shaker'], ['🥫', 'a tin can'],
  ['🍱', 'a bento box'], ['🍘', 'a rice cracker'], ['🍙', 'a rice ball'], ['🍠', 'a roasted sweet potato'], ['🍢', 'oden skewers'],
  ['🍥', 'a fish cake'], ['🥮', 'a mooncake'], ['🍡', 'dango'], ['🥠', 'a fortune cookie'], ['🥡', 'a takeout box'], ['🍧', 'shaved ice'],
  ['🍨', 'a bowl of ice cream'], ['🍰', 'a slice of cake'], ['🥧', 'a pie'], ['🍮', 'a flan pudding'], ['🍯', 'a honey pot'],
  ['🍼', 'a baby bottle'], ['🥛', 'a glass of milk'], ['🫖', 'a teapot'], ['🍶', 'sake'], ['🍾', 'a bottle of champagne'],
  ['🍹', 'a tropical cocktail'], ['🍻', 'beer mugs'], ['🥂', 'champagne glasses'], ['🥃', 'a glass of whisky'], ['🧋', 'bubble tea'],
  ['🧉', 'mate in a gourd'], ['🧊', 'ice cubes'], ['🥢', 'chopsticks'], ['🍽️', 'a plate with a fork and knife'], ['🥄', 'a spoon'],
  ['🔪', 'a kitchen knife'], ['🫙', 'a glass jar'], ['🏺', 'an ancient amphora'],

  // Places
  ['🌎', 'a globe'], ['🛘', 'a landslide'], ['🗻', 'Mount Fuji'], ['🏗️', 'a building under construction with a crane'], ['🧱', 'bricks'],
  ['🪨', 'a rock'], ['🪵', 'logs of wood'], ['🛖', 'a hut'], ['🏘️', 'houses'], ['🏚️', 'an abandoned house'], ['🏤', 'a post office'],
  ['🏥', 'a hospital'], ['🏦', 'a bank'], ['🏨', 'a hotel'], ['🏪', 'a convenience store'], ['🏫', 'a school'], ['🏬', 'a department store'],
  ['💒', 'a wedding chapel'], ['🕍', 'a synagogue'], ['🕋', 'the Kaaba in Mecca'], ['⛺', 'a tent'], ['🌆', 'a city at dusk'],
  ['🌇', 'a sunset over a city'], ['♨️', 'hot springs'], ['🎠', 'a carousel'], ['🛝', 'a playground slide'], ['💈', 'a barber pole'],

  // Transport
  ['🚃', 'a railway carriage'], ['🚄', 'a high-speed train'], ['🚅', 'a bullet train'], ['🚉', 'a train station'], ['🚊', 'a tram'],
  ['🚝', 'a monorail'], ['🚞', 'a mountain railway'], ['🚎', 'a trolleybus'], ['🚐', 'a minibus'], ['🚙', 'an SUV'], ['🛻', 'a pickup truck'],
  ['🚛', 'a semi truck'], ['🛵', 'a motor scooter'], ['🦽', 'a wheelchair'], ['🛺', 'an auto rickshaw'], ['🛹', 'a skateboard'],
  ['🛼', 'a roller skate'], ['🚏', 'a bus stop'], ['🛣️', 'a highway'], ['🛤️', 'railway tracks'], ['🛢️', 'an oil drum'], ['🛞', 'a tire'],
  ['🚨', 'a police siren light'], ['🛑', 'a stop sign'], ['🚧', 'a construction barrier'], ['🛟', 'a lifebuoy'], ['🛶', 'a canoe'],
  ['🚤', 'a speedboat'], ['🛳️', 'a cruise ship'], ['⛴️', 'a ferry'], ['🛥️', 'a motor yacht'], ['🛩️', 'a small propeller plane'],
  ['🛫', 'a plane taking off'], ['🛬', 'a plane landing'], ['🪂', 'a parachute'], ['💺', 'an airplane seat'], ['🚠', 'a cable car'],
  ['🛰️', 'a satellite'],

  // Sky and weather
  ['🌕', 'a full moon'], ['🌓', 'a half moon'], ['🌡️', 'a thermometer'], ['🪐', 'the planet Saturn'], ['🌠', 'a shooting star'],
  ['⛅', 'the sun behind clouds'], ['🌧️', 'rain'], ['🌨️', 'snowfall'], ['🌩️', 'lightning'], ['🌪️', 'a tornado'], ['🌫️', 'fog'],
  ['🌂', 'a closed umbrella'], ['☔', 'an umbrella in the rain'], ['⛱️', 'a beach umbrella'], ['⚡', 'a lightning bolt'], ['⛄', 'a snowman'],
  ['☄️', 'a comet'],

  // Events, sport and games
  ['🎇', 'a sparkler'], ['🎊', 'confetti'], ['🎎', 'Japanese dolls'], ['🎏', 'carp streamers'], ['🎐', 'a wind chime'], ['🧧', 'a red envelope'],
  ['🎀', 'a ribbon bow'], ['🎟️', 'tickets'], ['🎖️', 'a military medal'], ['🏅', 'a medal'], ['🥎', 'a softball'], ['🥏', 'a frisbee'],
  ['🎳', 'bowling pins'], ['🏏', 'cricket'], ['🏑', 'field hockey'], ['🏒', 'ice hockey'], ['🥍', 'lacrosse'], ['🥋', 'a martial arts uniform'],
  ['🥅', 'a goal net'], ['⛸️', 'an ice skate'], ['🎣', 'a fishing rod'], ['🤿', 'a diving mask'], ['🎿', 'skis'], ['🛷', 'a sled'],
  ['🥌', 'a curling stone'], ['🎯', 'a dartboard'], ['🪀', 'a yo-yo'], ['🔮', 'a crystal ball'], ['🪄', 'a magic wand'], ['🕹️', 'a joystick'],
  ['🎰', 'a slot machine'], ['🪅', 'a piñata'], ['🪩', 'a disco ball'], ['🪆', 'Russian nesting dolls'],

  // Clothes
  ['🧵', 'a spool of thread'], ['🪡', 'a sewing needle'], ['🧶', 'a ball of yarn'], ['🪢', 'a knot in a rope'], ['🕶️', 'sunglasses'],
  ['🥽', 'goggles'], ['🥼', 'a lab coat'], ['🦺', 'a safety vest'], ['👔', 'a shirt and tie'], ['👖', 'jeans'], ['🧣', 'a scarf'], ['🧤', 'gloves'],
  ['🧥', 'a coat'], ['🧦', 'socks'], ['👘', 'a kimono'], ['🥻', 'a sari'], ['🩱', 'a swimsuit'], ['🩳', 'shorts'], ['👙', 'a bikini'],
  ['👚', 'a blouse'], ['🪭', 'a folding fan'], ['👛', 'a purse'], ['👝', 'a clutch bag'], ['🛍️', 'shopping bags'], ['🩴', 'flip-flops'],
  ['👞', 'a leather shoe'], ['🥾', 'a hiking boot'], ['🥿', 'a flat shoe'], ['👡', 'a sandal'], ['🩰', 'ballet shoes'], ['👢', 'a boot'],
  ['👒', 'a sun hat'], ['🎓', 'a graduation cap'], ['🪖', 'a military helmet'], ['⛑️', 'a rescue helmet'], ['📿', 'prayer beads'], ['💄', 'lipstick'],

  // Music, screens and paper
  ['🎼', 'sheet music'], ['🎶', 'musical notes'], ['🎙️', 'a studio microphone'], ['🎛️', 'a mixing desk'], ['🎷', 'a saxophone'],
  ['🪊', 'a trombone'], ['🪗', 'an accordion'], ['🪕', 'a banjo'], ['🪘', 'a hand drum'], ['🪇', 'maracas'], ['🪈', 'a flute'], ['🪉', 'a harp'],
  ['🔋', 'a battery'], ['🔌', 'an electric plug'], ['🖨️', 'a printer'], ['💾', 'a floppy disk'], ['💿', 'a CD'], ['🧮', 'an abacus'],
  ['🎥', 'a movie camera'], ['🎞️', 'a film strip'], ['📽️', 'a film projector'], ['📸', 'a camera with a flash'], ['📹', 'a video camera'],
  ['📼', 'a videocassette'], ['🔍', 'a magnifying glass'], ['🏮', 'a red paper lantern'], ['🪔', 'an oil lamp'], ['📕', 'a closed book'],
  ['📓', 'a notebook'], ['📜', 'an old scroll'], ['📰', 'a newspaper'], ['🔖', 'a bookmark'], ['🏷️', 'a price tag'], ['🪙', 'coins'],
  ['🪎', 'a treasure chest'], ['💶', 'euro banknotes'], ['💳', 'a credit card'], ['🧾', 'a receipt'], ['📮', 'a red postbox'], ['📫', 'a mailbox'],
  ['🗳️', 'a ballot box'], ['🖋️', 'a fountain pen'], ['🖌️', 'a paintbrush'], ['🖍️', 'crayons'], ['📝', 'a written note'], ['💼', 'a briefcase'],
  ['📁', 'a file folder'], ['📅', 'a calendar'], ['📊', 'a bar chart'], ['📋', 'a clipboard'], ['📌', 'a pushpin'], ['📏', 'a ruler'],
  ['🗄️', 'a filing cabinet'], ['🗑️', 'a wastebasket'],

  // Tools and things at home
  ['🗝️', 'an old key'], ['🪓', 'an axe'], ['⛏️', 'a pickaxe'], ['🛠️', 'tools'], ['🗡️', 'a dagger'], ['🪃', 'a boomerang'], ['🏹', 'a bow and arrow'],
  ['🪚', 'a saw'], ['🪛', 'a screwdriver'], ['🔩', 'a nut and bolt'], ['🗜️', 'a clamp'], ['⚖️', 'a balance scale'], ['⛓️', 'chains'], ['🪝', 'a hook'],
  ['🧰', 'a toolbox'], ['🪜', 'a ladder'], ['🪏', 'a shovel'], ['⚗️', 'chemistry glassware'], ['🧪', 'a test tube'], ['🧫', 'a petri dish'],
  ['🧬', 'DNA'], ['📡', 'a satellite dish'], ['🩸', 'blood'], ['🩹', 'a bandage'], ['🩼', 'a crutch'], ['🩺', 'a stethoscope'],
  ['🩻', 'an x-ray image'], ['🚪', 'a door'], ['🛗', 'an elevator'], ['🪞', 'a mirror'], ['🪟', 'a window'], ['🛋️', 'a couch'], ['🪠', 'a plunger'],
  ['🚿', 'a shower'], ['🪤', 'a mousetrap'], ['🪒', 'a razor'], ['🧴', 'a lotion bottle'], ['🧷', 'a safety pin'], ['🧹', 'a broom'],
  ['🧺', 'a basket'], ['🪣', 'a bucket'], ['🫧', 'soap bubbles'], ['🪥', 'a toothbrush'], ['🧽', 'a sponge'], ['🧯', 'a fire extinguisher'],
  ['🛒', 'a shopping cart'], ['🛎️', 'a service bell'], ['🧳', 'a suitcase'], ['⏳', 'an hourglass'], ['⏱️', 'a stopwatch'], ['🕰️', 'a mantel clock'],
  ['🚬', 'a cigarette'], ['⚰️', 'a coffin'], ['🪦', 'a gravestone'], ['⚱️', 'an urn'], ['🧿', 'a blue evil eye amulet'], ['🪬', 'a hamsa'],
  ['🪧', 'a protest sign'], ['🪪', 'an ID card'],
];

/**
 * Everything "From the picture" can choose, as { emoji, name }: the palette (without its symbols and
 * coloured shapes, which only match a picture's colours) and the emojis above.
 */
export const PICTURE_VOCAB = [
  ...EMOJI_VOCAB.filter((entry) => entry.group !== 'symbols').map(({ emoji, name }) => ({ emoji, name })),
  ...PICTURE_EMOJIS.map(([emoji, name]) => ({ emoji, name })),
];
