import type { Guide } from "../types";

// Source: migration/content/pets.md. Phones from the crawl's tel: links
// (HSCO lost-and-found, HSCO main, county sheriff lines).
export const guide: Guide = {
  slug: "pets",
  en: {
    name: "Pets & Animals",
    kicker: "For pet owners",
    title: "Pets & Animals",
    intro:
      "Adoption, licensing, lost-and-found, low-cost care, and emergency help for pets across Redmond, Terrebonne, and Crooked River Ranch.",
    sections: [
      {
        heading: "Your pet checklist",
        bullets: [
          "Get your dog licensed through the Humane Society of Central Oregon. It is required in Deschutes County and can reunite you with a lost dog fast.",
          "Make sure your pet has a collar with current tags, and consider a microchip.",
          "Save the lost-and-found number now, before you need it: 541-923-0882 ext. 200.",
          "Report a lost or found pet to HSCO and to the Deschutes County Sheriff's Office right away.",
        ],
      },
      {
        heading: "Lost & found",
        kicker: "Act fast, it makes a difference",
        items: [
          { title: "HSCO lost & found line", body: "If you lose a pet, call right away and file a report.", note: "541-923-0882 ext. 200", phone: "541-923-0882" },
          { title: "Humane Society of Central Oregon (HSCO)", body: "The shelter for stray and surrendered animals in our area. Lost and found reporting program, adoptions, and reunification.", note: "Tuesday to Saturday, 10 am to 5:30 pm.", url: "https://www.hsco.org" },
          { title: "Deschutes County Sheriff, Animal Services", body: "The county picks up stray dogs and cats and takes them to HSCO. For strays and livestock, call the non-emergency line 541-693-6911; for lost pet stray reports, call 541-382-3537.", phone: "541-693-6911" },
        ],
      },
      {
        heading: "Adopt a pet",
        kicker: "Give a pet a home",
        items: [
          { title: "Humane Society of Central Oregon (HSCO)", body: "Open-admission shelter serving Central and Eastern Oregon since 1961. All adopted dogs and cats are spayed or neutered and up to date on vaccines. Walk in during adoption hours to meet available pets, or browse online.", note: "Tuesday to Saturday, 10 am to 5:30 pm.", url: "https://www.hsco.org" },
          { title: "Foster a pet", body: "HSCO also places animals in foster homes. Fostering helps animals get ready for adoption and saves lives. Contact HSCO to learn how to foster." },
        ],
      },
      {
        heading: "Licensing",
        kicker: "Required in Deschutes County",
        items: [
          { title: "Dog licensing", body: "All dogs in Deschutes County are required to be licensed. Licensing helps reunite lost dogs with their owners and is handled through HSCO. You can license or renew at HSCO or online.", url: "https://www.hsco.org" },
          { title: "Why it matters", body: "A licensed dog with current tags can often be reunited with their owner the same day it is found. Unlicensed dogs may stay at the shelter longer before being reunited, and face additional fees to reclaim." },
        ],
      },
      {
        heading: "Low-cost care",
        kicker: "Affordable help for your pet",
        items: [
          { title: "Spay/Neuter Assistance Program (SNAP)", body: "HSCO offers SNAP vouchers for low-income pet owners. Vouchers can be used at several local veterinary offices to cover or reduce the cost of spay or neuter surgery. Contact HSCO to apply." },
          { title: "Community Cat Program", body: "HSCO operates a trap-neuter-return (TNR) program for community cats (outdoor, feral, and stray cats). If you are caring for outdoor cats in your neighborhood, contact HSCO to learn about TNR resources." },
          { title: "Low-income pet support", body: "If you are struggling to afford care for your pet, contact HSCO or call 211 and describe your situation. 211 can connect you with local resources for pet food, veterinary assistance, and temporary boarding.", phone: "211" },
          { title: "HOPE Pet Food Bank", body: "Run by HSCO, the HOPE Pet Food Bank provides free pet food to community members in need. If you are having difficulty affording food for your pet, contact HSCO to ask about the program." },
        ],
      },
      {
        heading: "Pets outside",
        kicker: "Keeping pets safe in Central Oregon",
        bullets: [
          "Rattlesnakes are present in the high desert. Keep dogs on leash and on marked trails, especially in rocky terrain.",
          "Coyotes are active year-round. Keep small dogs and cats supervised, especially at dusk and dawn.",
          "Foxtail grass (cheatgrass) seeds can become embedded in a pet's skin, ears, or paws and cause serious injury. Check your pet after outdoor walks in late spring and summer.",
          "Wildfire smoke is harmful to pets too. During heavy smoke events, limit outdoor time for dogs and cats, especially older animals and those with respiratory conditions.",
        ],
        items: [
          { title: "Pets and wildfire", body: "If you need to evacuate, take your pets with you. Prepare a pet go-kit: food, water, medications, carrier or leash, and vaccination records. For more on emergency planning, see our Seasonal Safety page.", to: "/seasonal-safety" },
          { title: "Livestock and large animals", body: "If you have horses or other large animals, include them in your evacuation plan. Contact the Deschutes County Sheriff for large animal emergencies and evacuation support.", phone: "541-693-6911" },
        ],
      },
    ],
    related: [
      { label: "Seasonal Safety", to: "/seasonal-safety" },
      { label: "Get Outside", to: "/get-outside" },
      { label: "Community resources", to: "/resources" },
    ],
    footnote:
      "Pet resources and hours change. Always call ahead to confirm services before visiting. If something on this page looks out of date, let us know and we will fix it.",
    reviewed: "Last reviewed June 2026",
    metaTitle: "Pets & Animals | Redmond Compass",
    metaDescription:
      "Pet resources for Redmond, Oregon — adoption and licensing through HSCO, lost-and-found lines, low-cost spay/neuter, pet food bank, and outdoor safety.",
  },
  es: {
    name: "Mascotas y animales",
    kicker: "Para dueños de mascotas",
    title: "Mascotas y animales",
    intro:
      "Adopción, licencias, mascotas perdidas y encontradas, atención de bajo costo y ayuda de emergencia para mascotas en Redmond, Terrebonne y Crooked River Ranch.",
    sections: [
      {
        heading: "Tu lista para la mascota",
        bullets: [
          "Saca la licencia de tu perro con la Humane Society of Central Oregon. Es obligatoria en el condado de Deschutes y ayuda a recuperar rápido a un perro perdido.",
          "Asegúrate de que tu mascota tenga collar con placas al día, y considera un microchip.",
          "Guarda ya el número de mascotas perdidas, antes de necesitarlo: 541-923-0882 ext. 200.",
          "Reporta de inmediato una mascota perdida o encontrada a HSCO y a la oficina del Sheriff del condado de Deschutes.",
        ],
      },
      {
        heading: "Perdidos y encontrados",
        kicker: "Actúa rápido: hace la diferencia",
        items: [
          { title: "Línea de perdidos y encontrados de HSCO", body: "Si se te pierde una mascota, llama de inmediato y levanta un reporte.", note: "541-923-0882 ext. 200", phone: "541-923-0882" },
          { title: "Humane Society of Central Oregon (HSCO)", body: "El refugio de animales extraviados y entregados de nuestra zona. Programa de reportes de perdidos y encontrados, adopciones y reencuentros.", note: "Martes a sábado, de 10 am a 5:30 pm.", url: "https://www.hsco.org" },
          { title: "Sheriff del condado de Deschutes, Servicios de Animales", body: "El condado recoge perros y gatos extraviados y los lleva a HSCO. Para animales extraviados y ganado, llama a la línea de no emergencia 541-693-6911; para reportes de mascotas perdidas, llama al 541-382-3537.", phone: "541-693-6911" },
        ],
      },
      {
        heading: "Adopta una mascota",
        kicker: "Dale un hogar",
        items: [
          { title: "Humane Society of Central Oregon (HSCO)", body: "Refugio de admisión abierta que sirve al centro y este de Oregon desde 1961. Todos los perros y gatos adoptados salen esterilizados y con vacunas al día. Visítalos en horario de adopción para conocer a los animales disponibles, o míralos en línea.", note: "Martes a sábado, de 10 am a 5:30 pm.", url: "https://www.hsco.org" },
          { title: "Sé hogar temporal", body: "HSCO también coloca animales en hogares temporales. Ser hogar temporal ayuda a los animales a prepararse para la adopción y salva vidas. Contacta a HSCO para saber cómo participar." },
        ],
      },
      {
        heading: "Licencias",
        kicker: "Obligatorias en el condado de Deschutes",
        items: [
          { title: "Licencia para perros", body: "Todos los perros del condado de Deschutes deben tener licencia. La licencia ayuda a reunir a los perros perdidos con sus dueños y se tramita a través de HSCO, en persona o en línea.", url: "https://www.hsco.org" },
          { title: "Por qué importa", body: "Un perro con licencia y placas al día muchas veces vuelve con su dueño el mismo día en que lo encuentran. Los perros sin licencia pueden pasar más tiempo en el refugio y generar cargos extra para recuperarlos." },
        ],
      },
      {
        heading: "Atención de bajo costo",
        kicker: "Ayuda accesible para tu mascota",
        items: [
          { title: "Programa de esterilización SNAP", body: "HSCO ofrece vales SNAP para dueños de bajos ingresos. Se pueden usar en varias clínicas veterinarias locales para cubrir o reducir el costo de la esterilización. Contacta a HSCO para solicitarlo." },
          { title: "Programa de gatos comunitarios", body: "HSCO opera un programa de captura-esterilización-retorno (TNR) para gatos comunitarios (callejeros y ferales). Si cuidas gatos de exterior en tu vecindario, contacta a HSCO para conocer los recursos de TNR." },
          { title: "Apoyo para dueños de bajos ingresos", body: "Si te cuesta pagar la atención de tu mascota, contacta a HSCO o llama al 211 y explica tu situación. El 211 te conecta con recursos locales de comida para mascotas, ayuda veterinaria y hospedaje temporal.", phone: "211" },
          { title: "Banco de comida HOPE", body: "Operado por HSCO, el banco de comida HOPE da alimento gratuito para mascotas a quienes lo necesitan. Si te cuesta comprar la comida de tu mascota, pregunta a HSCO por el programa." },
        ],
      },
      {
        heading: "Mascotas al aire libre",
        kicker: "Cuidarlas en Central Oregon",
        bullets: [
          "Hay serpientes de cascabel en el alto desierto. Lleva a tu perro con correa y por senderos marcados, sobre todo en terreno rocoso.",
          "Los coyotes están activos todo el año. Vigila a los perros pequeños y a los gatos, sobre todo al amanecer y al atardecer.",
          "Las semillas del pasto foxtail (cheatgrass) pueden clavarse en la piel, orejas o patas y causar lesiones serias. Revisa a tu mascota después de pasear a fines de primavera y en verano.",
          "El humo de los incendios también daña a las mascotas. En días de humo denso, limita el tiempo afuera de perros y gatos, sobre todo animales mayores o con problemas respiratorios.",
        ],
        items: [
          { title: "Mascotas e incendios", body: "Si tienes que evacuar, llévate a tus mascotas. Prepara su kit de evacuación: comida, agua, medicamentos, transportadora o correa y cartilla de vacunas. Hay más sobre planes de emergencia en Seguridad estacional.", to: "/seasonal-safety" },
          { title: "Ganado y animales grandes", body: "Si tienes caballos u otros animales grandes, inclúyelos en tu plan de evacuación. Contacta al Sheriff del condado de Deschutes para emergencias y apoyo de evacuación de animales grandes.", phone: "541-693-6911" },
        ],
      },
    ],
    related: [
      { label: "Seguridad estacional", to: "/seasonal-safety" },
      { label: "Al aire libre", to: "/get-outside" },
      { label: "Recursos comunitarios", to: "/resources" },
    ],
    footnote:
      "Los recursos y horarios cambian. Llama antes de ir para confirmar los servicios. Si algo en esta página se ve desactualizado, cuéntanos y lo corregimos.",
    reviewed: "Última revisión: junio de 2026",
    metaTitle: "Mascotas y animales | Redmond Compass",
    metaDescription:
      "Recursos para mascotas en Redmond, Oregon: adopción y licencias con HSCO, líneas de perdidos y encontrados, esterilización de bajo costo, banco de comida y seguridad.",
  },
};
