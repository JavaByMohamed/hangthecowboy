// Guess Who - Multiple Categories (Solo + Multiplayer)

let socket;
try {
    socket = io();
} catch(e) {
    console.warn('Socket.IO not available, multiplayer disabled');
}

const categories = {
    celebrities: {
        label: "🎤 Celebrities",
        traitLabels: ["gender", "hair", "american", "singer", "actor", "glasses", "over40"],
        traitIcons: (t) => {
            const list = [];
            if (t.singer) list.push('🎤');
            if (t.actor) list.push('🎬');
            if (t.glasses) list.push('👓');
            if (t.american) list.push('🇺🇸');
            if (t.over40) list.push('40+');
            return list;
        },
        traitLine: (t) => `${t.hair} hair | ${t.gender}`,
        characters: [
            { name: "Taylor Swift", img: "🎤", traits: { gender: "female", hair: "blonde", american: true, singer: true, actor: false, glasses: false, over40: false } },
            { name: "Beyoncé", img: "👑", traits: { gender: "female", hair: "brown", american: true, singer: true, actor: false, glasses: false, over40: true } },
            { name: "Drake", img: "🎵", traits: { gender: "male", hair: "black", american: false, singer: true, actor: true, glasses: false, over40: true } },
            { name: "Adele", img: "🎶", traits: { gender: "female", hair: "brown", american: false, singer: true, actor: false, glasses: false, over40: false } },
            { name: "Ed Sheeran", img: "🎸", traits: { gender: "male", hair: "red", american: false, singer: true, actor: false, glasses: true, over40: false } },
            { name: "Rihanna", img: "💎", traits: { gender: "female", hair: "black", american: false, singer: true, actor: true, glasses: false, over40: true } },
            { name: "The Rock", img: "💪", traits: { gender: "male", hair: "bald", american: true, singer: false, actor: true, glasses: false, over40: true } },
            { name: "Oprah", img: "📺", traits: { gender: "female", hair: "black", american: true, singer: false, actor: true, glasses: true, over40: true } },
            { name: "Tom Hanks", img: "🎬", traits: { gender: "male", hair: "brown", american: true, singer: false, actor: true, glasses: false, over40: true } },
            { name: "Zendaya", img: "🌟", traits: { gender: "female", hair: "brown", american: true, singer: true, actor: true, glasses: false, over40: false } },
            { name: "Elon Musk", img: "🚀", traits: { gender: "male", hair: "brown", american: true, singer: false, actor: false, glasses: false, over40: true } },
            { name: "Billie Eilish", img: "🖤", traits: { gender: "female", hair: "blonde", american: true, singer: true, actor: false, glasses: false, over40: false } },
            { name: "Chris Hemsworth", img: "⚡", traits: { gender: "male", hair: "blonde", american: false, singer: false, actor: true, glasses: false, over40: true } },
            { name: "Ariana Grande", img: "☁️", traits: { gender: "female", hair: "brown", american: true, singer: true, actor: true, glasses: false, over40: false } },
            { name: "Morgan Freeman", img: "🎭", traits: { gender: "male", hair: "white", american: true, singer: false, actor: true, glasses: true, over40: true } },
            { name: "Lady Gaga", img: "🦄", traits: { gender: "female", hair: "blonde", american: true, singer: true, actor: true, glasses: true, over40: true } },
            { name: "Will Smith", img: "🤴", traits: { gender: "male", hair: "black", american: true, singer: true, actor: true, glasses: false, over40: true } },
            { name: "Emma Watson", img: "⚡", traits: { gender: "female", hair: "brown", american: false, singer: false, actor: true, glasses: false, over40: false } },
            { name: "Bruno Mars", img: "🎩", traits: { gender: "male", hair: "black", american: true, singer: true, actor: false, glasses: false, over40: true } },
            { name: "Shakira", img: "💃", traits: { gender: "female", hair: "blonde", american: false, singer: true, actor: false, glasses: false, over40: true } },
            { name: "Robert Downey Jr", img: "🦾", traits: { gender: "male", hair: "brown", american: true, singer: false, actor: true, glasses: true, over40: true } },
            { name: "Selena Gomez", img: "🌹", traits: { gender: "female", hair: "black", american: true, singer: true, actor: true, glasses: false, over40: false } },
            { name: "Keanu Reeves", img: "🔫", traits: { gender: "male", hair: "black", american: false, singer: false, actor: true, glasses: false, over40: true } },
            { name: "Post Malone", img: "🍺", traits: { gender: "male", hair: "brown", american: true, singer: true, actor: false, glasses: false, over40: false } },
        ]
    },
    animals: {
        label: "🐾 Animals",
        traitIcons: (t) => {
            const list = [];
            if (t.canFly) list.push('🪽');
            if (t.domestic) list.push('🏠');
            if (t.carnivore) list.push('🥩');
            if (t.aquatic) list.push('💧');
            if (t.big) list.push('🦣');
            return list;
        },
        traitLine: (t) => `${t.legs} legs | ${t.habitat}`,
        characters: [
            { name: "Dog", img: "🐕", traits: { legs: 4, habitat: "land", canFly: false, domestic: true, carnivore: true, aquatic: false, big: false, hasTail: true } },
            { name: "Cat", img: "🐈", traits: { legs: 4, habitat: "land", canFly: false, domestic: true, carnivore: true, aquatic: false, big: false, hasTail: true } },
            { name: "Eagle", img: "🦅", traits: { legs: 2, habitat: "air", canFly: true, domestic: false, carnivore: true, aquatic: false, big: false, hasTail: true } },
            { name: "Elephant", img: "🐘", traits: { legs: 4, habitat: "land", canFly: false, domestic: false, carnivore: false, aquatic: false, big: true, hasTail: true } },
            { name: "Dolphin", img: "🐬", traits: { legs: 0, habitat: "water", canFly: false, domestic: false, carnivore: true, aquatic: true, big: false, hasTail: true } },
            { name: "Penguin", img: "🐧", traits: { legs: 2, habitat: "land", canFly: false, domestic: false, carnivore: true, aquatic: true, big: false, hasTail: true } },
            { name: "Lion", img: "🦁", traits: { legs: 4, habitat: "land", canFly: false, domestic: false, carnivore: true, aquatic: false, big: true, hasTail: true } },
            { name: "Shark", img: "🦈", traits: { legs: 0, habitat: "water", canFly: false, domestic: false, carnivore: true, aquatic: true, big: true, hasTail: true } },
            { name: "Parrot", img: "🦜", traits: { legs: 2, habitat: "air", canFly: true, domestic: true, carnivore: false, aquatic: false, big: false, hasTail: true } },
            { name: "Snake", img: "🐍", traits: { legs: 0, habitat: "land", canFly: false, domestic: false, carnivore: true, aquatic: false, big: false, hasTail: false } },
            { name: "Horse", img: "🐴", traits: { legs: 4, habitat: "land", canFly: false, domestic: true, carnivore: false, aquatic: false, big: true, hasTail: true } },
            { name: "Frog", img: "🐸", traits: { legs: 4, habitat: "land", canFly: false, domestic: false, carnivore: true, aquatic: true, big: false, hasTail: false } },
            { name: "Whale", img: "🐋", traits: { legs: 0, habitat: "water", canFly: false, domestic: false, carnivore: true, aquatic: true, big: true, hasTail: true } },
            { name: "Owl", img: "🦉", traits: { legs: 2, habitat: "air", canFly: true, domestic: false, carnivore: true, aquatic: false, big: false, hasTail: true } },
            { name: "Rabbit", img: "🐰", traits: { legs: 4, habitat: "land", canFly: false, domestic: true, carnivore: false, aquatic: false, big: false, hasTail: true } },
            { name: "Bear", img: "🐻", traits: { legs: 4, habitat: "land", canFly: false, domestic: false, carnivore: true, aquatic: false, big: true, hasTail: true } },
            { name: "Goldfish", img: "🐠", traits: { legs: 0, habitat: "water", canFly: false, domestic: true, carnivore: false, aquatic: true, big: false, hasTail: true } },
            { name: "Butterfly", img: "🦋", traits: { legs: 6, habitat: "air", canFly: true, domestic: false, carnivore: false, aquatic: false, big: false, hasTail: false } },
            { name: "Turtle", img: "🐢", traits: { legs: 4, habitat: "land", canFly: false, domestic: true, carnivore: false, aquatic: true, big: false, hasTail: true } },
            { name: "Giraffe", img: "🦒", traits: { legs: 4, habitat: "land", canFly: false, domestic: false, carnivore: false, aquatic: false, big: true, hasTail: true } },
            { name: "Bat", img: "🦇", traits: { legs: 2, habitat: "air", canFly: true, domestic: false, carnivore: true, aquatic: false, big: false, hasTail: true } },
            { name: "Crab", img: "🦀", traits: { legs: 8, habitat: "water", canFly: false, domestic: false, carnivore: true, aquatic: true, big: false, hasTail: false } },
            { name: "Chicken", img: "🐔", traits: { legs: 2, habitat: "land", canFly: false, domestic: true, carnivore: false, aquatic: false, big: false, hasTail: true } },
            { name: "Octopus", img: "🐙", traits: { legs: 8, habitat: "water", canFly: false, domestic: false, carnivore: true, aquatic: true, big: false, hasTail: false } },
        ]
    },
    countries: {
        label: "🌍 Countries",
        traitIcons: (t) => {
            const list = [];
            if (t.large) list.push('🗺️');
            if (t.island) list.push('🏝️');
            if (t.coastal) list.push('🏖️');
            if (t.cold) list.push('❄️');
            if (t.european) list.push('🇪🇺');
            return list;
        },
        traitLine: (t) => `${t.continent} | ${t.population}`,
        characters: [
            { name: "USA", img: "🇺🇸", traits: { continent: "North America", population: "large", coastal: true, island: false, cold: false, european: false, large: true, english: true, flagColors: ["red", "white", "blue"] } },
            { name: "Japan", img: "🇯🇵", traits: { continent: "Asia", population: "large", coastal: true, island: true, cold: false, european: false, large: false, english: false, flagColors: ["red", "white"] } },
            { name: "Brazil", img: "🇧🇷", traits: { continent: "South America", population: "large", coastal: true, island: false, cold: false, european: false, large: true, english: false, flagColors: ["green", "yellow", "blue", "white"] } },
            { name: "Iceland", img: "🇮🇸", traits: { continent: "Europe", population: "small", coastal: true, island: true, cold: true, european: true, large: false, english: false, flagColors: ["blue", "red", "white"] } },
            { name: "Australia", img: "🇦🇺", traits: { continent: "Oceania", population: "medium", coastal: true, island: true, cold: false, european: false, large: true, english: true, flagColors: ["blue", "red", "white"] } },
            { name: "Egypt", img: "🇪🇬", traits: { continent: "Africa", population: "large", coastal: true, island: false, cold: false, european: false, large: true, english: false, flagColors: ["red", "white", "black"] } },
            { name: "France", img: "🇫🇷", traits: { continent: "Europe", population: "large", coastal: true, island: false, cold: false, european: true, large: false, english: false, flagColors: ["blue", "white", "red"] } },
            { name: "Canada", img: "🇨🇦", traits: { continent: "North America", population: "medium", coastal: true, island: false, cold: true, european: false, large: true, english: true, flagColors: ["red", "white"] } },
            { name: "Wales", img: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", traits: { continent: "Europe", population: "small", coastal: true, island: false, cold: true, european: true, large: false, english: true, flagColors: ["red", "white", "green"] } },
            { name: "Switzerland", img: "🇨🇭", traits: { continent: "Europe", population: "small", coastal: false, island: false, cold: true, european: true, large: false, english: false, flagColors: ["red", "white"] } },
            { name: "Nigeria", img: "🇳🇬", traits: { continent: "Africa", population: "large", coastal: true, island: false, cold: false, european: false, large: true, english: true, flagColors: ["green", "white"] } },
            { name: "New Zealand", img: "🇳🇿", traits: { continent: "Oceania", population: "small", coastal: true, island: true, cold: false, european: false, large: false, english: true, flagColors: ["blue", "red", "white"] } },
            { name: "Russia", img: "🇷🇺", traits: { continent: "Europe", population: "large", coastal: true, island: false, cold: true, european: true, large: true, english: false, flagColors: ["white", "blue", "red"] } },
            { name: "Mexico", img: "🇲🇽", traits: { continent: "North America", population: "large", coastal: true, island: false, cold: false, european: false, large: true, english: false, flagColors: ["green", "white", "red"] } },
            { name: "Sweden", img: "🇸🇪", traits: { continent: "Europe", population: "small", coastal: true, island: false, cold: true, european: true, large: false, english: false, flagColors: ["blue", "yellow"] } },
            { name: "Thailand", img: "🇹🇭", traits: { continent: "Asia", population: "large", coastal: true, island: false, cold: false, european: false, large: false, english: false, flagColors: ["red", "white", "blue"] } },
            { name: "Germany", img: "🇩🇪", traits: { continent: "Europe", population: "large", coastal: true, island: false, cold: false, european: true, large: false, english: false, flagColors: ["black", "red", "yellow"] } },
            { name: "Argentina", img: "🇦🇷", traits: { continent: "South America", population: "medium", coastal: true, island: false, cold: false, european: false, large: true, english: false, flagColors: ["blue", "white"] } },
            { name: "South Korea", img: "🇰🇷", traits: { continent: "Asia", population: "medium", coastal: true, island: false, cold: false, european: false, large: false, english: false, flagColors: ["white", "red", "blue", "black"] } },
            { name: "Kenya", img: "🇰🇪", traits: { continent: "Africa", population: "medium", coastal: true, island: false, cold: false, european: false, large: false, english: true, flagColors: ["black", "red", "green", "white"] } },
            { name: "Norway", img: "🇳🇴", traits: { continent: "Europe", population: "small", coastal: true, island: false, cold: true, european: true, large: false, english: false, flagColors: ["red", "white", "blue"] } },
            { name: "Cuba", img: "🇨🇺", traits: { continent: "North America", population: "small", coastal: true, island: true, cold: false, european: false, large: false, english: false, flagColors: ["blue", "white", "red"] } },
            { name: "China", img: "🇨🇳", traits: { continent: "Asia", population: "large", coastal: true, island: false, cold: false, european: false, large: true, english: false, flagColors: ["red", "yellow"] } },
            { name: "Mongolia", img: "🇲🇳", traits: { continent: "Asia", population: "small", coastal: false, island: false, cold: true, european: false, large: true, english: false, flagColors: ["red", "blue", "yellow"] } },
        ]
    },
    cartoons: {
        label: "🎨 Cartoon Characters",
        traitIcons: (t) => {
            const list = [];
            if (t.superpowers) list.push('⚡');
            if (t.animal) list.push('🐾');
            if (t.villain) list.push('😈');
            if (t.child) list.push('👶');
            if (t.funny) list.push('😂');
            return list;
        },
        traitLine: (t) => `${t.gender} | ${t.show}`,
        characters: [
            { name: "SpongeBob", img: "🧽", traits: { gender: "male", show: "Nickelodeon", superpowers: false, animal: false, villain: false, child: false, funny: true, human: false } },
            { name: "Mickey Mouse", img: "🐭", traits: { gender: "male", show: "Disney", superpowers: false, animal: true, villain: false, child: false, funny: true, human: false } },
            { name: "Bugs Bunny", img: "🐰", traits: { gender: "male", show: "Warner Bros", superpowers: false, animal: true, villain: false, child: false, funny: true, human: false } },
            { name: "Batman", img: "🦇", traits: { gender: "male", show: "DC", superpowers: false, animal: false, villain: false, child: false, funny: false, human: true } },
            { name: "Homer Simpson", img: "🍩", traits: { gender: "male", show: "Fox", superpowers: false, animal: false, villain: false, child: false, funny: true, human: true } },
            { name: "Elsa", img: "❄️", traits: { gender: "female", show: "Disney", superpowers: true, animal: false, villain: false, child: false, funny: false, human: true } },
            { name: "Tom (Tom & Jerry)", img: "🐱", traits: { gender: "male", show: "Warner Bros", superpowers: false, animal: true, villain: false, child: false, funny: true, human: false } },
            { name: "Pikachu", img: "⚡", traits: { gender: "male", show: "Nintendo", superpowers: true, animal: true, villain: false, child: false, funny: false, human: false } },
            { name: "Dora", img: "🗺️", traits: { gender: "female", show: "Nickelodeon", superpowers: false, animal: false, villain: false, child: true, funny: false, human: true } },
            { name: "Shrek", img: "🟢", traits: { gender: "male", show: "DreamWorks", superpowers: false, animal: false, villain: false, child: false, funny: true, human: false } },
            { name: "Superman", img: "🦸", traits: { gender: "male", show: "DC", superpowers: true, animal: false, villain: false, child: false, funny: false, human: true } },
            { name: "Scooby-Doo", img: "🐕", traits: { gender: "male", show: "Warner Bros", superpowers: false, animal: true, villain: false, child: false, funny: true, human: false } },
            { name: "Rapunzel", img: "👸", traits: { gender: "female", show: "Disney", superpowers: true, animal: false, villain: false, child: false, funny: false, human: true } },
            { name: "Goku", img: "💥", traits: { gender: "male", show: "Anime", superpowers: true, animal: false, villain: false, child: false, funny: false, human: true } },
            { name: "Patrick Star", img: "⭐", traits: { gender: "male", show: "Nickelodeon", superpowers: false, animal: true, villain: false, child: false, funny: true, human: false } },
            { name: "Wonder Woman", img: "🦸‍♀️", traits: { gender: "female", show: "DC", superpowers: true, animal: false, villain: false, child: false, funny: false, human: true } },
            { name: "Garfield", img: "🐱", traits: { gender: "male", show: "Other", superpowers: false, animal: true, villain: false, child: false, funny: true, human: false } },
            { name: "Dexter", img: "🔬", traits: { gender: "male", show: "Cartoon Network", superpowers: false, animal: false, villain: false, child: true, funny: true, human: true } },
            { name: "Kim Possible", img: "📱", traits: { gender: "female", show: "Disney", superpowers: false, animal: false, villain: false, child: true, funny: false, human: true } },
            { name: "The Joker", img: "🃏", traits: { gender: "male", show: "DC", superpowers: false, animal: false, villain: true, child: false, funny: false, human: true } },
            { name: "Naruto", img: "🍥", traits: { gender: "male", show: "Anime", superpowers: true, animal: false, villain: false, child: false, funny: true, human: true } },
            { name: "Maleficent", img: "🧙‍♀️", traits: { gender: "female", show: "Disney", superpowers: true, animal: false, villain: true, child: false, funny: false, human: false } },
            { name: "Bart Simpson", img: "📛", traits: { gender: "male", show: "Fox", superpowers: false, animal: false, villain: false, child: true, funny: true, human: true } },
            { name: "Nemo", img: "🐟", traits: { gender: "male", show: "Disney", superpowers: false, animal: true, villain: false, child: true, funny: false, human: false } },
        ]
    },
    sports: {
        label: "⚽ Sports Stars",
        traitIcons: (t) => {
            const list = [];
            if (t.retired) list.push('🏁');
            if (t.olympic) list.push('🥇');
            if (t.american) list.push('🇺🇸');
            if (t.over35) list.push('35+');
            return list;
        },
        traitLine: (t) => `${t.sport} | ${t.gender}`,
        characters: [
            { name: "Messi", img: "⚽", traits: { gender: "male", sport: "football", american: false, retired: false, olympic: true, over35: true, team: true } },
            { name: "Serena Williams", img: "🎾", traits: { gender: "female", sport: "tennis", american: true, retired: true, olympic: true, over35: true, team: false } },
            { name: "LeBron James", img: "🏀", traits: { gender: "male", sport: "basketball", american: true, retired: false, olympic: true, over35: true, team: true } },
            { name: "Usain Bolt", img: "🏃", traits: { gender: "male", sport: "athletics", american: false, retired: true, olympic: true, over35: true, team: false } },
            { name: "Cristiano Ronaldo", img: "⚽", traits: { gender: "male", sport: "football", american: false, retired: false, olympic: false, over35: true, team: true } },
            { name: "Simone Biles", img: "🤸", traits: { gender: "female", sport: "gymnastics", american: true, retired: false, olympic: true, over35: false, team: false } },
            { name: "Michael Phelps", img: "🏊", traits: { gender: "male", sport: "swimming", american: true, retired: true, olympic: true, over35: true, team: false } },
            { name: "Naomi Osaka", img: "🎾", traits: { gender: "female", sport: "tennis", american: false, retired: false, olympic: true, over35: false, team: false } },
            { name: "Tom Brady", img: "🏈", traits: { gender: "male", sport: "american football", american: true, retired: true, olympic: false, over35: true, team: true } },
            { name: "Neymar", img: "⚽", traits: { gender: "male", sport: "football", american: false, retired: false, olympic: true, over35: true, team: true } },
            { name: "Megan Rapinoe", img: "⚽", traits: { gender: "female", sport: "football", american: true, retired: true, olympic: true, over35: true, team: true } },
            { name: "Roger Federer", img: "🎾", traits: { gender: "male", sport: "tennis", american: false, retired: true, olympic: true, over35: true, team: false } },
            { name: "Katie Ledecky", img: "🏊", traits: { gender: "female", sport: "swimming", american: true, retired: false, olympic: true, over35: false, team: false } },
            { name: "Kylian Mbappé", img: "⚽", traits: { gender: "male", sport: "football", american: false, retired: false, olympic: false, over35: false, team: true } },
            { name: "Stephen Curry", img: "🏀", traits: { gender: "male", sport: "basketball", american: true, retired: false, olympic: true, over35: true, team: true } },
            { name: "Tiger Woods", img: "⛳", traits: { gender: "male", sport: "golf", american: true, retired: false, olympic: false, over35: true, team: false } },
            { name: "Shacarri Richardson", img: "🏃‍♀️", traits: { gender: "female", sport: "athletics", american: true, retired: false, olympic: true, over35: false, team: false } },
            { name: "Lewis Hamilton", img: "🏎️", traits: { gender: "male", sport: "racing", american: false, retired: false, olympic: false, over35: true, team: true } },
            { name: "Alex Morgan", img: "⚽", traits: { gender: "female", sport: "football", american: true, retired: true, olympic: true, over35: true, team: true } },
            { name: "Novak Djokovic", img: "🎾", traits: { gender: "male", sport: "tennis", american: false, retired: false, olympic: true, over35: true, team: false } },
            { name: "Shaquille O'Neal", img: "🏀", traits: { gender: "male", sport: "basketball", american: true, retired: true, olympic: true, over35: true, team: true } },
            { name: "Coco Gauff", img: "🎾", traits: { gender: "female", sport: "tennis", american: true, retired: false, olympic: true, over35: false, team: false } },
            { name: "Mohamed Salah", img: "⚽", traits: { gender: "male", sport: "football", american: false, retired: false, olympic: false, over35: true, team: true } },
            { name: "Lindsey Vonn", img: "⛷️", traits: { gender: "female", sport: "skiing", american: true, retired: true, olympic: true, over35: true, team: false } },
        ]
    }
};

let currentCategory = 'celebrities';
let characters = categories.celebrities.characters;

function selectCategory(key) {
    currentCategory = key;
    characters = categories[key].characters;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-category="${key}"]`).classList.add('active');
}

let mode = null; // 'solo' or 'multiplayer'
let secretCharacter = null;
let mySecret = null; // in multiplayer, the character assigned to you
let eliminated = new Set();
let questionsAsked = 0;
let gameOver = false;
let myTurn = true;
let gameId = null;
let playerNum = null;
let isPrivateGame = false;
let matchmakingType = null; // 'random' | 'create-private' | 'join-private'

// --- MODE SELECTION ---

function startSolo() {
    mode = 'solo';
    secretCharacter = characters[Math.floor(Math.random() * characters.length)];
    eliminated = new Set();
    questionsAsked = 0;
    gameOver = false;
    myTurn = true;
    document.getElementById('mode-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('your-secret').style.display = 'none';
    document.getElementById('turn-indicator').textContent = 'Ask a yes/no question to find the celebrity!';
    document.getElementById('chat-log').innerHTML = '';
    document.getElementById('questionInput').value = '';
    updateInfo();
    renderBoard();
}

function startMultiplayer() {
    mode = 'multiplayer';
    initInviteSystem();
}

function initInviteSystem() {
    const status = document.getElementById('mp-status');
    status.classList.remove('hidden');
    InviteSystem.init({ gameType: 'guesswho' });
    InviteSystem.renderInviteOptions(
        'mp-status',
        () => {
            matchmakingType = 'random';
            isPrivateGame = false;
            document.getElementById('mp-status').classList.remove('hidden');
            document.getElementById('mp-status').textContent = '⏳ Looking for opponent...';
            document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = true);
            socket.emit('gw-join');
        },
        () => {
            matchmakingType = 'create-private';
            isPrivateGame = true;
            document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = true);
            InviteSystem.createPrivateGame({}, (response) => {
                gameId = response.gameId;
                document.getElementById('mp-status').classList.remove('hidden');
                InviteSystem.renderWaitingWithCode('mp-status', 'Invite a Friend to Guess Who');
            });
        },
        (code) => {
            matchmakingType = 'join-private';
            isPrivateGame = true;
            document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = true);
            InviteSystem.joinByCode(code, {}, (response) => {
                if (!response.success) {
                    document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = false);
                    return;
                }
                gameId = response.gameId;
                document.getElementById('mp-status').classList.remove('hidden');
                document.getElementById('mp-status').textContent = '⏳ Joined! Waiting for pick phase...';
            });
        }
    );
}

function showPickScreen(gId) {
    gameId = gId;
    document.getElementById('mode-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('your-secret').style.display = 'none';
    document.getElementById('turn-indicator').textContent = '👆 Pick your secret celebrity! (Your opponent will try to guess it)';
    document.getElementById('questions-count').textContent = '';
    document.getElementById('chat-log').innerHTML = '';
    document.querySelector('.question-panel').style.display = 'none';
    document.querySelector('.actions').style.display = 'none';

    const board = document.getElementById('board');
    board.innerHTML = '';
    const cat = categories[currentCategory];
    characters.forEach((char) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        const traitList = cat.traitIcons(char.traits);
        card.innerHTML = `
            <div class="avatar">${char.img}</div>
            <div class="name">${char.name}</div>
            <div class="traits">${cat.traitLine(char.traits)} | ${traitList.join(' ')}</div>
        `;
        card.onclick = () => {
            if (confirm(`Pick ${char.name} as your secret celebrity?`)) {
                socket.emit('gw-choose-secret', { gameId, name: char.name });
                document.getElementById('turn-indicator').textContent = '⏳ Waiting for opponent to pick...';
                board.querySelectorAll('.char-card').forEach(c => c.style.pointerEvents = 'none');
                card.style.border = '2px solid gold';
                card.style.opacity = '1';
            }
        };
        board.appendChild(card);
    });
}

function backToMenu() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('game-area').classList.add('hidden');
    document.getElementById('mode-select').classList.remove('hidden');
    document.getElementById('mp-status').classList.add('hidden');
    document.querySelectorAll('.mode-buttons button').forEach(b => b.disabled = false);
    mode = null;
    matchmakingType = null;
    isPrivateGame = false;
    gameOver = true;
    if (typeof showChatWidget === 'function') showChatWidget(false);
}

// --- SOLO MODE LOGIC ---

function evaluateQuestion(q) {
    const lower = q.toLowerCase();
    const t = secretCharacter.traits;

    // Generic: try to match any boolean trait
    for (const [key, val] of Object.entries(t)) {
        if (typeof val === 'boolean') {
            const keyLower = key.toLowerCase();
            // Check if the question mentions this trait
            if (lower.includes(keyLower) || lower.includes(key.replace(/([A-Z])/g, ' $1').toLowerCase())) {
                return val ? 'Yes ✅' : 'No ❌';
            }
        }
    }

    // Celebrity-specific
    if (currentCategory === 'celebrities') {
        if (lower.includes('male') || lower.includes(' man') || lower.includes(' guy') || lower.includes(' he') || lower.includes('boy')) return t.gender === 'male' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('female') || lower.includes('woman') || lower.includes(' she') || lower.includes('girl') || lower.includes('lady')) return t.gender === 'female' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('blonde') || lower.includes('blond')) return t.hair === 'blonde' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('red hair') || lower.includes('ginger') || lower.includes('redhead')) return t.hair === 'red' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('brown hair')) return t.hair === 'brown' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('black hair')) return t.hair === 'black' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('white hair') || lower.includes('grey hair') || lower.includes('gray hair')) return t.hair === 'white' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('bald') || lower.includes('no hair')) return t.hair === 'bald' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('over 40') || lower.includes('older') || lower.includes('old') || lower.includes('40')) return t.over40 ? 'Yes ✅' : 'No ❌';
        if (lower.includes('young') || lower.includes('under 40')) return !t.over40 ? 'Yes ✅' : 'No ❌';
        return "🤔 Try asking about: gender, hair color, American, singer, actor, glasses, or over 40.";
    }

    // Animals
    if (currentCategory === 'animals') {
        if (lower.includes('fly') || lower.includes('wing')) return t.canFly ? 'Yes ✅' : 'No ❌';
        if (lower.includes('domestic') || lower.includes('pet') || lower.includes('house')) return t.domestic ? 'Yes ✅' : 'No ❌';
        if (lower.includes('meat') || lower.includes('carnivore') || lower.includes('predator')) return t.carnivore ? 'Yes ✅' : 'No ❌';
        if (lower.includes('water') || lower.includes('swim') || lower.includes('aquatic') || lower.includes('ocean') || lower.includes('sea')) return t.aquatic ? 'Yes ✅' : 'No ❌';
        if (lower.includes('big') || lower.includes('large') || lower.includes('huge')) return t.big ? 'Yes ✅' : 'No ❌';
        if (lower.includes('small') || lower.includes('tiny')) return !t.big ? 'Yes ✅' : 'No ❌';
        if (lower.includes('tail')) return t.hasTail ? 'Yes ✅' : 'No ❌';
        if (lower.includes('4 legs') || lower.includes('four legs')) return t.legs === 4 ? 'Yes ✅' : 'No ❌';
        if (lower.includes('2 legs') || lower.includes('two legs')) return t.legs === 2 ? 'Yes ✅' : 'No ❌';
        if (lower.includes('no legs')) return t.legs === 0 ? 'Yes ✅' : 'No ❌';
        if (lower.includes('land')) return t.habitat === 'land' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('air') || lower.includes('sky')) return t.habitat === 'air' ? 'Yes ✅' : 'No ❌';
        return "🤔 Try asking about: fly, domestic/pet, carnivore/meat, aquatic/water, big, tail, legs (4/2/0), habitat (land/air/water).";
    }

    // Countries
    if (currentCategory === 'countries') {
        if (lower.includes('europe')) return t.european ? 'Yes ✅' : 'No ❌';
        if (lower.includes('asia')) return t.continent === 'Asia' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('africa')) return t.continent === 'Africa' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('south america')) return t.continent === 'South America' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('north america')) return t.continent === 'North America' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('oceania')) return t.continent === 'Oceania' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('island')) return t.island ? 'Yes ✅' : 'No ❌';
        if (lower.includes('coast') || lower.includes('beach') || lower.includes('sea')) return t.coastal ? 'Yes ✅' : 'No ❌';
        if (lower.includes('cold') || lower.includes('snow') || lower.includes('freezing')) return t.cold ? 'Yes ✅' : 'No ❌';
        if (lower.includes('big') || lower.includes('large')) return t.large ? 'Yes ✅' : 'No ❌';
        if (lower.includes('small')) return t.population === 'small' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('english')) return t.english ? 'Yes ✅' : 'No ❌';
        // Flag colors
        const flagColorWords = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'orange'];
        for (const color of flagColorWords) {
            if (lower.includes(color)) return t.flagColors.includes(color) ? 'Yes ✅' : 'No ❌';
        }
        return "🤔 Try asking about: continent, island, coastal, cold, large, English-speaking, or flag colors (red/blue/green/yellow/white/black).";
    }

    // Cartoons
    if (currentCategory === 'cartoons') {
        if (lower.includes('male') || lower.includes(' man') || lower.includes(' he') || lower.includes(' boy') || lower.includes(' guy')) return t.gender === 'male' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('female') || lower.includes('woman') || lower.includes(' she') || lower.includes('girl')) return t.gender === 'female' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('super') || lower.includes('power')) return t.superpowers ? 'Yes ✅' : 'No ❌';
        if (lower.includes('animal')) return t.animal ? 'Yes ✅' : 'No ❌';
        if (lower.includes('villain') || lower.includes('bad') || lower.includes('evil')) return t.villain ? 'Yes ✅' : 'No ❌';
        if (lower.includes('child') || lower.includes('kid') || lower.includes('young')) return t.child ? 'Yes ✅' : 'No ❌';
        if (lower.includes('funny') || lower.includes('comedy') || lower.includes('humor')) return t.funny ? 'Yes ✅' : 'No ❌';
        if (lower.includes('human')) return t.human ? 'Yes ✅' : 'No ❌';
        if (lower.includes('disney')) return t.show === 'Disney' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('dc')) return t.show === 'DC' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('anime')) return t.show === 'Anime' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('nickelodeon') || lower.includes('nick')) return t.show === 'Nickelodeon' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('warner')) return t.show === 'Warner Bros' ? 'Yes ✅' : 'No ❌';
        return "🤔 Try asking about: gender, superpowers, animal, villain, child, funny, human, or show (Disney/DC/Anime/Nickelodeon/Warner Bros).";
    }

    // Sports
    if (currentCategory === 'sports') {
        if (lower.includes('male') || lower.includes(' man') || lower.includes(' he') || lower.includes(' guy')) return t.gender === 'male' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('female') || lower.includes('woman') || lower.includes(' she')) return t.gender === 'female' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('football') || lower.includes('soccer')) return t.sport === 'football' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('tennis')) return t.sport === 'tennis' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('basketball')) return t.sport === 'basketball' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('swimming') || lower.includes('swim')) return t.sport === 'swimming' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('athletics') || lower.includes('track') || lower.includes('sprint') || lower.includes('run')) return t.sport === 'athletics' ? 'Yes ✅' : 'No ❌';
        if (lower.includes('american') || lower.includes('usa') || lower.includes('us')) return t.american ? 'Yes ✅' : 'No ❌';
        if (lower.includes('retired') || lower.includes('retire')) return t.retired ? 'Yes ✅' : 'No ❌';
        if (lower.includes('olympic') || lower.includes('olympics')) return t.olympic ? 'Yes ✅' : 'No ❌';
        if (lower.includes('over 35') || lower.includes('35') || lower.includes('old')) return t.over35 ? 'Yes ✅' : 'No ❌';
        if (lower.includes('team')) return t.team ? 'Yes ✅' : 'No ❌';
        if (lower.includes('individual') || lower.includes('solo')) return !t.team ? 'Yes ✅' : 'No ❌';
        return "🤔 Try asking about: gender, sport (football/tennis/basketball/swimming/athletics), American, retired, Olympic, over 35, team sport.";
    }

    return "🤔 I don't understand that question. Try rephrasing!";
}

// --- BOARD RENDERING ---

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    const cat = categories[currentCategory];
    characters.forEach((char, i) => {
        const card = document.createElement('div');
        card.className = 'char-card' + (eliminated.has(i) ? ' eliminated' : '');
        const traitList = cat.traitIcons(char.traits);
        card.innerHTML = `
            <div class="avatar">${char.img}</div>
            <div class="name">${char.name}</div>
            <div class="traits">${cat.traitLine(char.traits)} | ${traitList.join(' ')}</div>
        `;
        card.onclick = () => toggleEliminate(i);
        board.appendChild(card);
    });
}

function toggleEliminate(index) {
    if (gameOver) return;
    if (eliminated.has(index)) eliminated.delete(index);
    else eliminated.add(index);
    renderBoard();
}

function updateInfo() {
    document.getElementById('questions-count').textContent = `❓ Questions: ${questionsAsked}`;
}

// --- ASK QUESTION ---

function askQuestion() {
    if (gameOver) return;
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return;

    if (mode === 'solo') {
        questionsAsked++;
        const answer = evaluateQuestion(question);
        addChatMsg('You: ' + question, 'question');
        addChatMsg('AI: ' + answer, 'answer');
        updateInfo();
    } else {
        if (!myTurn) {
            addChatMsg('⚠️ Wait for your turn!', 'answer');
            return;
        }
        socket.emit('gw-ask', { gameId, question });
        questionsAsked++;
        updateInfo();
    }
    input.value = '';
}

// --- MAKE GUESS ---

function makeGuess() {
    if (gameOver) return;
    if (mode === 'multiplayer' && !myTurn) {
        addChatMsg('⚠️ Wait for your turn!', 'answer');
        return;
    }

    const guess = prompt('Who do you think it is? Type the celebrity name:');
    if (!guess) return;

    if (mode === 'solo') {
        questionsAsked++;
        const normalizedGuess = guess.trim().toLowerCase();
        const normalizedAnswer = secretCharacter.name.toLowerCase();
        if (normalizedGuess === normalizedAnswer || normalizedAnswer.includes(normalizedGuess) || normalizedGuess.includes(normalizedAnswer)) {
            gameOver = true;
            showOverlay('🎉 Correct!', `It was ${secretCharacter.name} ${secretCharacter.img}! You got it in ${questionsAsked} questions.`);
        } else {
            addChatMsg('You guessed: ' + guess, 'question');
            addChatMsg('❌ Wrong! Keep trying!', 'answer');
            updateInfo();
        }
    } else {
        socket.emit('gw-guess', { gameId, guess: guess.trim() });
    }
}

function giveUp() {
    if (gameOver) return;
    gameOver = true;
    if (mode === 'solo') {
        showOverlay('😅 Gave Up', `The celebrity was ${secretCharacter.name} ${secretCharacter.img}.`);
    } else {
        socket.emit('gw-giveup', { gameId });
    }
}

// --- CHAT ---

function addChatMsg(text, type) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = 'msg ' + type;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

// --- OVERLAY ---

function showOverlay(title, msg) {
    document.getElementById('overlayTitle').textContent = title;
    document.getElementById('overlayMsg').textContent = msg;
    document.getElementById('overlay').classList.remove('hidden');
}

// --- MULTIPLAYER SOCKET EVENTS ---

socket.on('gw-pick', (data) => {
    showPickScreen(data.gameId);
    playerNum = data.playerNum;
    document.getElementById('mp-status').classList.add('hidden');
    if (typeof showChatWidget === 'function') showChatWidget(true);
});

socket.on('gw-waiting-pick', () => {
    document.getElementById('turn-indicator').textContent = '⏳ Waiting for opponent to pick their celebrity...';
});

socket.on('gw-start', (data) => {
    gameId = data.gameId;
    playerNum = data.playerNum;
    mySecret = data.yourSecret;
    secretCharacter = data.opponentSecret;
    eliminated = new Set();
    questionsAsked = 0;
    gameOver = false;
    myTurn = data.yourTurn;

    document.getElementById('mode-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.querySelector('.question-panel').style.display = '';
    document.querySelector('.actions').style.display = '';
    document.getElementById('your-secret').style.display = 'block';
    document.getElementById('your-secret-name').textContent = `${mySecret.name} ${mySecret.img}`;
    document.getElementById('turn-indicator').textContent = myTurn ? "Your turn to ask!" : "Opponent's turn...";
    document.getElementById('chat-log').innerHTML = '';
    document.getElementById('questionInput').value = '';
    updateInfo();
    renderBoard();
});

socket.on('gw-question', (data) => {
    addChatMsg(`${data.from}: ${data.question}`, 'question');
    addChatMsg(`Answer: ${data.answer}`, 'answer');
    myTurn = data.yourTurn;
    document.getElementById('turn-indicator').textContent = myTurn ? "Your turn to ask!" : "Opponent's turn...";
});

socket.on('gw-win', (data) => {
    gameOver = true;
    showOverlay('🎉 You Win!', data.msg);
});

socket.on('gw-lose', (data) => {
    gameOver = true;
    showOverlay('😢 You Lose!', data.msg);
});

socket.on('gw-opponent-quit', () => {
    gameOver = true;
    showOverlay('🚪 Opponent Left', 'Your opponent disconnected. You win by default!');
});
