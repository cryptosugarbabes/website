export type Profile = {
  id: string;
  name: string;
  age: number;
  city: string;
  country: string;
  headline: string;
  bio: string;
  initials: string;
  verified: boolean;
  online: boolean;
  tags: string[];
  colors: [string, string, string];
  motif: string;
  imageUrl?: string;
  sample?: boolean;
  photos?: string[];
  messagesSent?: number;
  messagesReceived?: number;
  photoLikes?: number;
  giftsUsdc?: number;
  reviewStatus?: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  isOwn?: boolean;
};

export const profiles: Profile[] = [
  {
    id: "amara-lisbon",
    name: "Amara",
    age: 28,
    city: "Lisbon",
    country: "Portugal",
    headline: "Art weekends, ocean air, and a very good espresso",
    bio: "Gallery regular, design obsessive, and spontaneous weekend traveller. I value generosity of spirit, wit, and plans that turn into stories.",
    initials: "AM",
    verified: true,
    online: true,
    tags: ["Art", "Sailing", "Fine dining"],
    colors: ["#c99579", "#55304a", "#1d1321"],
    motif: "coast",
    imageUrl: "/editorial/amara.webp",
    sample: true,
    messagesSent: 162,
    messagesReceived: 214,
    photoLikes: 438
  },
  {
    id: "celine-paris",
    name: "Celine",
    age: 31,
    city: "Paris",
    country: "France",
    headline: "Soft power, sharp conversation",
    bio: "A curious mind with a weakness for architecture, jazz bars, and beautifully planned escapes. Privacy and mutual respect matter to me.",
    initials: "CE",
    verified: true,
    online: false,
    tags: ["Architecture", "Jazz", "Travel"],
    colors: ["#bf9084", "#3c3142", "#15151a"],
    motif: "city",
    imageUrl: "/editorial/celine.webp",
    sample: true,
    messagesSent: 91,
    messagesReceived: 108,
    photoLikes: 286
  },
  {
    id: "sofia-milan",
    name: "Sofia",
    age: 26,
    city: "Milan",
    country: "Italy",
    headline: "Fashion energy with a bookish side",
    bio: "Stylist, reader, and professional finder of the best table in the room. Looking for genuine chemistry and a reason to pack a carry-on.",
    initials: "SO",
    verified: true,
    online: true,
    tags: ["Fashion", "Books", "Weekends away"],
    colors: ["#d8b079", "#784b49", "#23161d"],
    motif: "sunset",
    imageUrl: "/editorial/sofia.webp",
    sample: true,
    messagesSent: 334,
    messagesReceived: 477,
    photoLikes: 913
  },
  {
    id: "maya-dubai",
    name: "Maya",
    age: 29,
    city: "Dubai",
    country: "UAE",
    headline: "Passport ready, standards high",
    bio: "Entrepreneurial, warm, and always curious about what is being built next. I enjoy considered experiences and effortless conversation.",
    initials: "MY",
    verified: true,
    online: false,
    tags: ["Startups", "Wellness", "Design"],
    colors: ["#e1bc8d", "#7a5647", "#251b21"],
    motif: "dunes",
    imageUrl: "/editorial/maya.webp",
    sample: true,
    messagesSent: 58,
    messagesReceived: 75,
    photoLikes: 167
  },
  {
    id: "elena-barcelona",
    name: "Elena",
    age: 33,
    city: "Barcelona",
    country: "Spain",
    headline: "Long lunches and last-minute flights",
    bio: "Creative director with a calm temperament and an adventurous calendar. Here for inspiring people, beautiful places, and honest intentions.",
    initials: "EL",
    verified: true,
    online: true,
    tags: ["Food", "Photography", "Culture"],
    colors: ["#dc8d76", "#6b3547", "#23151f"],
    motif: "terrace",
    imageUrl: "/editorial/elena.webp",
    sample: true,
    messagesSent: 219,
    messagesReceived: 301,
    photoLikes: 641
  },
  {
    id: "naomi-london",
    name: "Naomi",
    age: 30,
    city: "London",
    country: "United Kingdom",
    headline: "Equal parts polish and playfulness",
    bio: "Museum member, Sunday-roast loyalist, and occasional escape artist. I appreciate emotional intelligence and people who make things happen.",
    initials: "NA",
    verified: true,
    online: false,
    tags: ["Theatre", "Museums", "Country escapes"],
    colors: ["#b9908d", "#493847", "#17151c"],
    motif: "night",
    imageUrl: "/editorial/naomi.webp",
    sample: true,
    messagesSent: 703,
    messagesReceived: 818,
    photoLikes: 1284
  }
];
