import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const games = [
  {
    title: "Dark Souls III",
    slug: "dark-souls-iii",
    description:
      "A challenging action RPG set in the crumbling kingdom of Lothric, known for its punishing combat and interconnected level design.",
    releaseDate: new Date("2016-04-12"),
    developer: "FromSoftware",
    publisher: "Bandai Namco Entertainment",
  },
  {
    title: "Elden Ring",
    slug: "elden-ring",
    description:
      "An open-world action RPG co-created with George R. R. Martin, exploring the Lands Between.",
    releaseDate: new Date("2022-02-25"),
    developer: "FromSoftware",
    publisher: "Bandai Namco Entertainment",
  },
  {
    title: "Minecraft",
    slug: "minecraft",
    description:
      "A sandbox game about placing blocks and going on adventures in procedurally generated worlds.",
    releaseDate: new Date("2011-11-18"),
    developer: "Mojang Studios",
    publisher: "Mojang Studios",
  },
  {
    title: "The Witcher 3: Wild Hunt",
    slug: "the-witcher-3-wild-hunt",
    description:
      "An open-world RPG following monster hunter Geralt of Rivia as he searches for his adopted daughter.",
    releaseDate: new Date("2015-05-19"),
    developer: "CD Projekt Red",
    publisher: "CD Projekt",
  },
  {
    title: "God of War",
    slug: "god-of-war",
    description:
      "An action-adventure game following Kratos and his son Atreus through the realms of Norse mythology.",
    releaseDate: new Date("2018-04-20"),
    developer: "Santa Monica Studio",
    publisher: "Sony Interactive Entertainment",
  },
];

async function main() {
  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: game,
    });
  }
  console.log(`Seeded ${games.length} games.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
