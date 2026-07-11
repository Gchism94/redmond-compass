import type { Guide } from "../types";

// Source: migration/content/ember.md — the Ember Cuen memorial page. Images are
// self-hosted (public/guides/) so they outlive the Base44 cancellation. Handle
// this page's copy with care; it is a memorial.
export const guide: Guide = {
  slug: "ember",
  en: {
    name: "Take Ember",
    title: "Take Ember — Take Her Adventures Further",
    intro: "Her adventures ended too soon. Let's help her see the world anyway.",
    sections: [
      {
        heading: "Ember's story",
        body: "Ember Cuen was a beloved part of our Redmond community. She had a spirit that lit up every room, a heart full of wonder, and a love for adventure that knew no bounds. Whether she was exploring the outdoors, caring for animals, or making the people around her smile, Ember reminded everyone that joy is found in the simple, beautiful moments.",
        bullets: ["Things Ember loved: adventure", "Family", "Animals", "The outdoors", "Making others smile"],
        image: { src: "/guides/ember-flyer.jpg", alt: "Ember Cuen memorial flyer" },
      },
      {
        heading: "About the stickers",
        body: "Ember drew a heart and wrote her name inside it in her own handwriting. That simple, beautiful drawing became these stickers. Each one carries a piece of Ember, so that wherever it travels, she travels too. Let's show her the world.",
        image: { src: "/guides/ember-sticker.jpg", alt: "The Take Ember sticker, made from Ember's handwriting and drawing" },
      },
      {
        heading: "Take Ember with you",
        body: "Four simple ways to carry Ember's light on your adventures.",
        items: [
          { title: "Snap", body: "Take a photo of the sticker with you wherever you go." },
          { title: "Share", body: "Share where Ember traveled on your adventure." },
          { title: "Post", body: "Post it on Facebook or Instagram and tag #EmbersGlow." },
          { title: "You never know", body: "You never know where Ember will go next!" },
        ],
      },
      {
        heading: "Where will Ember go?",
        body: "From Redmond to the Oregon Coast. From Oregon to Europe. From mountain trails to city streets. Every photo, every mile, every destination becomes part of her story.",
      },
      {
        heading: "Get stickers",
        body: "Stickers are available for anyone in the Redmond community who would like to take Ember on an adventure. Email to request yours, and we'll send one your way.\n\nThank you for helping keep Ember's adventures going.",
      },
    ],
    contactEmail: "Ember's light is everywhere. Let's help her see the world.",
    metaTitle: "Take Ember | Redmond Compass",
    metaDescription:
      "The Ember Cuen memorial — take a Take Ember sticker on your adventures, share where she travels with #EmbersGlow, and help her see the world.",
  },
  es: {
    name: "Take Ember",
    title: "Take Ember — que sus aventuras lleguen más lejos",
    intro: "Sus aventuras terminaron demasiado pronto. Ayudémosla a conocer el mundo de todos modos.",
    sections: [
      {
        heading: "La historia de Ember",
        body: "Ember Cuen fue una parte muy querida de nuestra comunidad de Redmond. Tenía un espíritu que iluminaba cada lugar, un corazón lleno de asombro y un amor por la aventura sin límites. Ya fuera explorando la naturaleza, cuidando animales o haciendo sonreír a quienes la rodeaban, Ember nos recordaba a todos que la alegría está en los momentos simples y hermosos.",
        bullets: ["Lo que Ember amaba: la aventura", "Su familia", "Los animales", "La naturaleza", "Hacer sonreír a los demás"],
        image: { src: "/guides/ember-flyer.jpg", alt: "Volante conmemorativo de Ember Cuen" },
      },
      {
        heading: "Sobre las calcomanías",
        body: "Ember dibujó un corazón y escribió su nombre adentro, con su propia letra. Ese dibujo simple y hermoso se convirtió en estas calcomanías. Cada una lleva un pedacito de Ember, para que a donde viaje la calcomanía, viaje ella también. Mostrémosle el mundo.",
        image: { src: "/guides/ember-sticker.jpg", alt: "La calcomanía Take Ember, hecha con la letra y el dibujo de Ember" },
      },
      {
        heading: "Lleva a Ember contigo",
        body: "Cuatro maneras sencillas de llevar la luz de Ember en tus aventuras.",
        items: [
          { title: "Fotografía", body: "Tómale una foto a la calcomanía a donde quiera que vayas." },
          { title: "Comparte", body: "Cuenta a dónde viajó Ember en tu aventura." },
          { title: "Publica", body: "Súbela a Facebook o Instagram con la etiqueta #EmbersGlow." },
          { title: "Nunca se sabe", body: "¡Nunca se sabe a dónde irá Ember la próxima vez!" },
        ],
      },
      {
        heading: "¿A dónde irá Ember?",
        body: "De Redmond a la costa de Oregon. De Oregon a Europa. De los senderos de montaña a las calles de la ciudad. Cada foto, cada milla, cada destino se vuelve parte de su historia.",
      },
      {
        heading: "Pide tus calcomanías",
        body: "Las calcomanías están disponibles para cualquier persona de la comunidad de Redmond que quiera llevar a Ember de aventura. Escríbenos un correo para pedir la tuya y te la enviamos.\n\nGracias por ayudar a que las aventuras de Ember continúen.",
      },
    ],
    contactEmail: "La luz de Ember está en todas partes. Ayudémosla a conocer el mundo.",
    metaTitle: "Take Ember | Redmond Compass",
    metaDescription:
      "El memorial de Ember Cuen: lleva una calcomanía Take Ember en tus aventuras, comparte sus viajes con #EmbersGlow y ayúdala a conocer el mundo.",
  },
};
