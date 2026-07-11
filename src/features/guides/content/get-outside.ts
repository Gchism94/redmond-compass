import type { Guide } from "../types";

// Source: migration/content/get-outside.md — Smith Rock, Dry Canyon, parks,
// trails, winter recreation, and outdoor safety.
export const guide: Guide = {
  slug: "get-outside",
  en: {
    name: "Get Outside",
    kicker: "Outdoor recreation",
    title: "Get Outside",
    intro:
      "From a world-famous climbing destination in Terrebonne to a canyon trail that runs right through downtown Redmond, the outdoors is always close.",
    sections: [
      {
        heading: "Our backyard at a glance",
        bullets: [
          "Smith Rock State Park in Terrebonne: one of the top climbing destinations in the country, and a spectacular hike for everyone.",
          "Dry Canyon Trail: nearly 4 miles of paved trail running through an ancient canyon in the heart of Redmond.",
          "The Crooked River winds through both Smith Rock and the surrounding terrain, offering fishing, wildlife watching, and scenery.",
          "Sno-parks and winter recreation are a short drive away when the season turns.",
        ],
      },
      {
        heading: "Smith Rock State Park",
        kicker: "Terrebonne, right next door",
        body: "One of the seven wonders of Oregon and considered the birthplace of American sport climbing, Smith Rock rises 600 feet above the Crooked River just outside Terrebonne. The park is a world-class destination for rock climbing, hiking, wildlife watching, and photography, and it is less than 10 miles from downtown Redmond. Dogs are welcome on leash.",
        items: [
          { title: "Hiking", body: "The Misery Ridge Trail is the park's iconic route with sweeping high desert views. Easier options follow the river below the cliffs. Trails range from flat river walks to steep climbs.", note: "Open dawn to dusk daily, year-round." },
          { title: "Rock climbing", body: "More than 1,500 routes across all skill levels, from beginner-friendly to some of the most demanding climbs in the country. No permit needed to climb; a vehicle day-use permit is required to park." },
          { title: "Day-use parking", body: "A day-use vehicle permit is required: $10 for Oregon residents, $12.50 for non-Oregon residents. Annual passes available at the park Welcome Center, online, and at Oliver Lemon's in Terrebonne. Bivy camping is available first-come, first-serve at $12 per person per night.", url: "https://stateparks.oregon.gov" },
          { title: "Getting there", body: "From Redmond, head north on US-97, take the Terrebonne exit, and follow signs." },
        ],
      },
      {
        heading: "Dry Canyon Trail",
        kicker: "Right through downtown Redmond",
        body: "An ancient lava canyon cuts right through the middle of Redmond, and the city has turned it into one of Central Oregon's best urban trail systems. The main paved trail runs nearly 4 miles from NW 19th Street in the north to Quartz Avenue in the south, connecting parks, sports fields, a disc golf course, an amphitheater, and open high desert habitat. The canyon walls are a geological wonder and the trail is flat, wide, and accessible to walkers, cyclists, skaters, and strollers.",
        items: [
          { title: "Trail details", body: "Paved, mostly flat (less than 5% grade throughout), 3.8 miles one way. Multiple access points with parking, restrooms, water, and picnic areas. Dogs are welcome on leash.", note: "Free, no permit needed. Open year-round." },
          { title: "Trailheads and access", body: "Main north trailhead: NW 19th St, Redmond. Main south access: Quartz Avenue. Bowlby Park and American Legion Park (850 SW Rimrock Way) are accessible mid-trail entry points, with accessible parking at multiple locations." },
          { title: "What to explore", body: "Sports fields, playgrounds, a disc golf course, an amphitheater, interpretive kiosks about the canyon's geology, cliff swallow colonies, and open juniper-sagebrush habitat in the northern stretch. Wildlife sightings include foxes, deer, and ground squirrels." },
          { title: "More info", body: "Managed by the Redmond Area Park and Recreation District (RAPRD) and City of Redmond Parks.", url: "https://www.redmondoregon.gov" },
        ],
      },
      {
        heading: "Parks & fields",
        kicker: "Close to home",
        items: [
          { title: "Redmond Area Park and Recreation District (RAPRD)", body: "Manages parks, athletic fields, playgrounds, and the activity center across Redmond. Find a full list of parks and facilities at raprd.org.", phone: "541-548-6066", url: "https://raprd.org" },
          { title: "RAPRD Activity Center", body: "Indoor recreation, fitness, classes, and youth and adult programs.", url: "https://raprd.org" },
          { title: "Terrebonne Community Park", body: "A neighborhood park and gathering space in Terrebonne, close to Smith Rock." },
          { title: "Crooked River Ranch recreation", body: "Crooked River Ranch maintains its own parks and open space for residents of the community." },
        ],
      },
      {
        heading: "Trails & nature",
        kicker: "Explore further",
        items: [
          { title: "Crooked River", body: "Flows through Smith Rock State Park and winds through the surrounding high desert. Popular for fly fishing, wildlife watching (eagles, herons, river otters), and scenery. Check Oregon Department of Fish and Wildlife for current fishing regulations.", url: "https://myodfw.com" },
          { title: "Gray Butte Trail", body: "A moderately challenging out-and-back trail north of Redmond with panoramic views of the Cascades and high desert. Access via Lone Pine Road. Part of the BLM Prineville District." },
          { title: "Cove Palisades State Park", body: "About 30 minutes from Redmond, this park sits above Lake Billy Chinook at the confluence of three river canyons. Swimming, boating, camping, and dramatic canyon views.", url: "https://stateparks.oregon.gov" },
          { title: "Prineville Reservoir State Park", body: "About 20 miles from Redmond, popular for boating, fishing, and camping.", url: "https://stateparks.oregon.gov" },
          { title: "Cline Falls State Scenic Viewpoint", body: "A roadside rest area on the banks of the Deschutes River, just south of Redmond. Shaded picnic spots, fishing access, and river views. Be aware of swift currents and hidden obstructions — do not swim, float, or boat without a life jacket.", note: "Day-use parking permit required ($5 on site). No alcohol without a permit." },
          { title: "Steelhead Falls Trail", body: "A short, relatively easy 0.5-mile hike to a scenic waterfall on the Deschutes River, managed by the BLM Prineville District. Colorful grooved cliffs, spring wildflowers, and golden eagles overhead. Watch for rattlesnakes around rocks and brush; leash dogs at the trailhead and camping area.", note: "Open year-round, no fees. Overnight camping first come, first served." },
          { title: "Tumalo Falls Day Use Area", body: "A popular Deschutes National Forest site with beautiful views of Tumalo Falls just minutes from the trailhead. Picnicking, hiking, and mountain biking (North Fork Trail is uphill-only for bikes). Dogs, bikes, and camping are prohibited inside the Bend Municipal Watershed.", note: "Day use only. $5 per vehicle per day or a recreation pass required. 27-foot vehicle length limit." },
        ],
      },
      {
        heading: "Winter & sno-parks",
        kicker: "When the snow arrives",
        items: [
          { title: "Hoodoo Ski Area", body: "A full ski and snowboard resort on the Santiam Pass, about an hour from Redmond.", url: "https://skihoodoo.com" },
          { title: "Swampy Lakes and Meissner sno-parks", body: "Cross-country skiing and snowshoeing in the Deschutes National Forest, southeast of Bend. Oregon Sno-Park permits required from November through April." },
          { title: "Sno-Park permits", body: "Required for all sno-park use November 1 through April 30. Daily and seasonal permits. Buy online at tripcheck.com, at Oregon DMV, or at sporting goods stores.", url: "https://tripcheck.com" },
        ],
      },
      {
        heading: "Safety outside",
        kicker: "Before you go",
        body: "Summers in our area are sunny, dry, and hot, often above 90 degrees. Winters bring cold snaps, wind, and occasional ice. The sun is intense year-round at our elevation. For every outing: bring more water than you think you need, apply sunscreen, tell someone your plan and when to expect you back, and check the weather before you head out.",
        items: [
          { title: "Heat and sun", body: "Most trails in this area have little shade. Start hikes early, especially in summer. Carry at least one liter of water per person per hour of activity. Know the signs of heat exhaustion: heavy sweating, weakness, cold or pale skin, a fast weak pulse, nausea." },
          { title: "Fire and smoke", body: "During wildfire season, smoke can arrive quickly and trails may close. Check air quality before heading out and have a plan to turn back. See our Seasonal Safety page for air quality resources.", to: "/seasonal-safety" },
          { title: "Wildlife", body: "Our area is home to rattlesnakes, coyotes, and birds of prey. Stay on marked trails, keep dogs leashed, and give wildlife space. Smith Rock has seasonal climbing closures to protect nesting raptors." },
          { title: "Emergency", body: "For a wilderness emergency, call 911. In areas without cell service, carry a satellite communicator. Download a trail app or use a paper map for trails outside cell coverage.", phone: "911" },
        ],
      },
    ],
    related: [
      { label: "Seasonal Safety", to: "/seasonal-safety" },
      { label: "Pets outside", to: "/pets" },
      { label: "Events calendar", to: "/events" },
    ],
    footnote: "Conditions, fees, and seasonal closures change. Check with the park or land manager before your visit. Enjoy what makes this place special.",
    reviewed: "Last reviewed June 2026",
    metaTitle: "Get Outside | Redmond Compass",
    metaDescription:
      "The outdoors around Redmond, Oregon — Smith Rock State Park, Dry Canyon Trail, parks, rivers, waterfalls, sno-parks, and high desert safety tips.",
  },
  es: {
    name: "Al aire libre",
    kicker: "Recreación al aire libre",
    title: "Al aire libre",
    intro:
      "Desde un destino de escalada mundialmente famoso en Terrebonne hasta un sendero de cañón que atraviesa el centro de Redmond, la naturaleza siempre está cerca.",
    sections: [
      {
        heading: "Nuestro patio trasero de un vistazo",
        bullets: [
          "Smith Rock State Park en Terrebonne: uno de los mejores destinos de escalada del país y una caminata espectacular para cualquiera.",
          "Dry Canyon Trail: casi 4 millas de sendero pavimentado por un cañón antiguo en pleno corazón de Redmond.",
          "El río Crooked serpentea por Smith Rock y sus alrededores, con pesca, observación de fauna y paisajes.",
          "Los sno-parks y la recreación de invierno quedan a un corto viaje en auto cuando cambia la temporada.",
        ],
      },
      {
        heading: "Smith Rock State Park",
        kicker: "Terrebonne, aquí al lado",
        body: "Una de las siete maravillas de Oregon y considerado la cuna de la escalada deportiva estadounidense, Smith Rock se eleva 600 pies sobre el río Crooked a las afueras de Terrebonne. El parque es un destino de clase mundial para escalar, caminar, observar fauna y fotografiar, y está a menos de 10 millas del centro de Redmond. Los perros son bienvenidos con correa.",
        items: [
          { title: "Senderismo", body: "El Misery Ridge Trail es la ruta icónica del parque, con vistas amplias del alto desierto. Hay opciones más fáciles junto al río, bajo los acantilados. Los senderos van desde caminatas planas hasta subidas empinadas.", note: "Abierto del amanecer al anochecer, todo el año." },
          { title: "Escalada en roca", body: "Más de 1,500 rutas para todos los niveles, desde aptas para principiantes hasta algunas de las escaladas más exigentes del país. No se necesita permiso para escalar; sí un permiso vehicular de uso diario para estacionar." },
          { title: "Estacionamiento de uso diario", body: "Se requiere permiso vehicular: $10 para residentes de Oregon, $12.50 para no residentes. Pases anuales en el Welcome Center del parque, en línea y en Oliver Lemon's en Terrebonne. Hay campamento estilo vivac por orden de llegada a $12 por persona por noche.", url: "https://stateparks.oregon.gov" },
          { title: "Cómo llegar", body: "Desde Redmond, toma la US-97 hacia el norte, sal en Terrebonne y sigue los letreros." },
        ],
      },
      {
        heading: "Dry Canyon Trail",
        kicker: "Atraviesa el centro de Redmond",
        body: "Un antiguo cañón de lava corta justo por el medio de Redmond, y la ciudad lo convirtió en uno de los mejores sistemas de senderos urbanos de Central Oregon. El sendero principal pavimentado recorre casi 4 millas desde NW 19th Street en el norte hasta Quartz Avenue en el sur, conectando parques, canchas deportivas, un campo de disc golf, un anfiteatro y hábitat abierto de alto desierto. Las paredes del cañón son una maravilla geológica y el sendero es plano, ancho y accesible para caminantes, ciclistas, patinadores y carriolas.",
        items: [
          { title: "Detalles del sendero", body: "Pavimentado, casi plano (pendiente menor al 5% en todo el recorrido), 3.8 millas por sentido. Varios accesos con estacionamiento, baños, agua y áreas de pícnic. Perros bienvenidos con correa.", note: "Gratis, sin permiso. Abierto todo el año." },
          { title: "Accesos", body: "Acceso norte principal: NW 19th St, Redmond. Acceso sur principal: Quartz Avenue. Bowlby Park y American Legion Park (850 SW Rimrock Way) son entradas a mitad del sendero, con estacionamiento accesible en varios puntos." },
          { title: "Qué explorar", body: "Canchas deportivas, juegos infantiles, disc golf, un anfiteatro, kioscos interpretativos sobre la geología del cañón, colonias de golondrinas y hábitat abierto de junípero y artemisa en el tramo norte. Se pueden ver zorros, venados y ardillas de tierra." },
          { title: "Más información", body: "Administrado por el Redmond Area Park and Recreation District (RAPRD) y los parques de la Ciudad de Redmond.", url: "https://www.redmondoregon.gov" },
        ],
      },
      {
        heading: "Parques y canchas",
        kicker: "Cerca de casa",
        items: [
          { title: "Redmond Area Park and Recreation District (RAPRD)", body: "Administra parques, canchas, juegos infantiles y el centro de actividades de Redmond. La lista completa está en raprd.org.", phone: "541-548-6066", url: "https://raprd.org" },
          { title: "Centro de actividades RAPRD", body: "Recreación bajo techo, gimnasio, clases y programas para niños y adultos.", url: "https://raprd.org" },
          { title: "Terrebonne Community Park", body: "Un parque vecinal y punto de encuentro en Terrebonne, cerca de Smith Rock." },
          { title: "Recreación en Crooked River Ranch", body: "Crooked River Ranch mantiene sus propios parques y espacios abiertos para los residentes de la comunidad." },
        ],
      },
      {
        heading: "Senderos y naturaleza",
        kicker: "Explora más allá",
        items: [
          { title: "Río Crooked", body: "Fluye por Smith Rock State Park y serpentea por el alto desierto. Popular para pesca con mosca, observación de fauna (águilas, garzas, nutrias de río) y paisajes. Consulta el reglamento de pesca vigente del Departamento de Pesca y Vida Silvestre de Oregon.", url: "https://myodfw.com" },
          { title: "Gray Butte Trail", body: "Un sendero de ida y vuelta de dificultad moderada al norte de Redmond, con vistas panorámicas de las Cascades y el alto desierto. Acceso por Lone Pine Road. Parte del distrito BLM de Prineville." },
          { title: "Cove Palisades State Park", body: "A unos 30 minutos de Redmond, sobre el lago Billy Chinook, en la confluencia de tres cañones. Natación, paseos en lancha, campamento y vistas impresionantes.", url: "https://stateparks.oregon.gov" },
          { title: "Prineville Reservoir State Park", body: "A unas 20 millas de Redmond, popular para lanchas, pesca y campamento.", url: "https://stateparks.oregon.gov" },
          { title: "Cline Falls State Scenic Viewpoint", body: "Un área de descanso a orillas del río Deschutes, al sur de Redmond. Pícnic con sombra, acceso de pesca y vistas al río. Cuidado con las corrientes rápidas y los obstáculos ocultos: no nades, flotes ni navegues sin chaleco salvavidas.", note: "Permiso de estacionamiento de uso diario ($5 en el sitio). No se permite alcohol sin permiso." },
          { title: "Steelhead Falls Trail", body: "Una caminata corta y relativamente fácil de media milla a una cascada escénica del río Deschutes, administrada por el BLM de Prineville. Acantilados de colores, flores silvestres en primavera y águilas doradas en lo alto. Cuidado con las serpientes de cascabel entre rocas y matorrales; lleva a tu perro con correa en el acceso y el área de campamento.", note: "Abierto todo el año, sin tarifas. Campamento nocturno por orden de llegada." },
          { title: "Tumalo Falls Day Use Area", body: "Un sitio popular del Bosque Nacional Deschutes con vistas hermosas de las cataratas Tumalo a minutos del acceso. Pícnic, senderismo y ciclismo de montaña (el North Fork Trail es solo de subida para bicis). Perros, bicis y campamento están prohibidos dentro de la cuenca municipal de Bend.", note: "Solo uso diurno. $5 por vehículo por día o pase de recreación. Límite de 27 pies de largo por vehículo." },
        ],
      },
      {
        heading: "Invierno y sno-parks",
        kicker: "Cuando llega la nieve",
        items: [
          { title: "Hoodoo Ski Area", body: "Un centro de esquí y snowboard completo en el paso Santiam, a una hora de Redmond.", url: "https://skihoodoo.com" },
          { title: "Sno-parks Swampy Lakes y Meissner", body: "Esquí de fondo y raquetas de nieve en el Bosque Nacional Deschutes, al sureste de Bend. Se requiere permiso Sno-Park de Oregon de noviembre a abril." },
          { title: "Permisos Sno-Park", body: "Obligatorios para usar los sno-parks del 1 de noviembre al 30 de abril. Hay permisos diarios y de temporada. Cómpralos en línea en tripcheck.com, en el DMV de Oregon o en tiendas deportivas.", url: "https://tripcheck.com" },
        ],
      },
      {
        heading: "Seguridad al aire libre",
        kicker: "Antes de salir",
        body: "Los veranos aquí son soleados, secos y calurosos, muchas veces por encima de los 90 grados. Los inviernos traen olas de frío, viento y hielo ocasional. El sol es intenso todo el año a nuestra altitud. En cada salida: lleva más agua de la que crees necesitar, ponte bloqueador, avísale a alguien tu plan y hora de regreso, y revisa el clima antes de salir.",
        items: [
          { title: "Calor y sol", body: "La mayoría de los senderos de la zona tienen poca sombra. Empieza temprano, sobre todo en verano. Lleva al menos un litro de agua por persona por hora de actividad. Conoce las señales del agotamiento por calor: sudoración intensa, debilidad, piel fría o pálida, pulso rápido y débil, náuseas." },
          { title: "Fuego y humo", body: "En temporada de incendios, el humo puede llegar rápido y los senderos pueden cerrar. Revisa la calidad del aire antes de salir y ten un plan para regresar. Mira nuestra página de Seguridad estacional.", to: "/seasonal-safety" },
          { title: "Fauna silvestre", body: "Nuestra zona tiene serpientes de cascabel, coyotes y aves rapaces. Mantente en los senderos marcados, lleva a tu perro con correa y dale espacio a los animales. Smith Rock cierra rutas de escalada por temporada para proteger nidos de rapaces." },
          { title: "Emergencias", body: "Para una emergencia en zona silvestre, llama al 911. Donde no hay señal, lleva un comunicador satelital. Descarga una app de senderos o lleva mapa de papel fuera de la cobertura celular.", phone: "911" },
        ],
      },
    ],
    related: [
      { label: "Seguridad estacional", to: "/seasonal-safety" },
      { label: "Mascotas al aire libre", to: "/pets" },
      { label: "Calendario de eventos", to: "/events" },
    ],
    footnote: "Las condiciones, tarifas y cierres de temporada cambian. Confirma con el parque o el administrador del terreno antes de tu visita. Disfruta lo que hace especial a este lugar.",
    reviewed: "Última revisión: junio de 2026",
    metaTitle: "Al aire libre | Redmond Compass",
    metaDescription:
      "La naturaleza alrededor de Redmond, Oregon: Smith Rock State Park, Dry Canyon Trail, parques, ríos, cascadas, sno-parks y consejos de seguridad del alto desierto.",
  },
};
