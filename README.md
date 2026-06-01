# 🎬 YouTube Mini Player con Ratings y Resolución

**Mini reproductor flotante para YouTube** que te permite seguir viendo vídeos mientras navegas por la web.  
Incluye **puntuación de likes/dislikes** (vía Return YouTube Dislike), **resolución del vídeo**, botón flotante personalizable, arrastre, cambio de tamaño y posiciones persistentes.

![Userscript](https://img.shields.io/badge/Userscript-Compatible-brightgreen)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue)

---

## ✨ Características

- 📺 **Reproductor flotante** que se superpone a cualquier página de YouTube.
- ⭐ **Valoración del vídeo** (porcentaje de likes) en la miniatura y dentro del mini reproductor.
- 🎯 **Resolución del vídeo** (SD, HD, FHD, 4K, etc.) mostrada en la miniatura y en el panel de control.
- 🖱️ **Arrastre** del mini reproductor (activable/desactivable desde la barra superior).
- 🔘 **Botón flotante** en las miniaturas: posición ajustable (8 posiciones diferentes).
- 📏 **Cambio de tamaño** (3 tamaños predefinidos) que se guarda automáticamente.
- 💾 **Posición y configuración persistente** en `localStorage`.
- 🌐 **Internacionalización** (español e inglés automáticos según el idioma del navegador).
- 🔄 **Resincronización dinámica** al navegar dentro de YouTube (SPA).

---

## 🚀 Instalación

1. Instala una extensión de usuarioscripts en tu navegador:
   - [Tampermonkey](https://www.tampermonkey.net/) (recomendado)
   - [Violentmonkey](https://violentmonkey.github.io/)
   - [Greasemonkey](https://www.greasespot.net/)

2. Haz clic en el siguiente enlace o crea un nuevo script y pega el código completo:
   - [**Instalar YouTube Mini Player**](https://github.com/Dragunthor/mini-player/blob/main/YouTube%20Mini%20Player%20con%20Ratings%20y%20Resolucion-2025.08.13.user.js)  

3. El script se activará automáticamente en `https://www.youtube.com/*`.

> 🔁 Si actualizas el script manualmente, los ajustes guardados (tamaño, posición, preferencias) se conservarán.

---

## 🕹️ Uso

### Botón flotante en miniaturas
- Aparece un botón **▶** en cada miniatura de vídeo (excepto en la página de reproducción actual).
- Al hacer clic, se abre el mini reproductor flotante con el vídeo.
- El botón se resalta en verde cuando su vídeo está activo en el reproductor.

### Controles del mini reproductor (barra superior)

| Botón | Función |
|-------|---------|
| ⛶ / ❐ | Expandir / restaurar (ocupa toda la pantalla) |
| ⤢ | Cambiar tamaño (360p → 520p → 640p) |
| ? | Mostrar resolución actual (HD, FHD, 4K, etc.) |
| ⭐ / ☆ | Activar / desactivar el porcentaje de likes en miniaturas |
| ✜ | Activar / desactivar arrastre (cursor se vuelve "mover") |
| Posición (icono de círculo) | Cambiar posición del botón flotante en miniaturas (8 opciones) |
| 🗙 | Cerrar el mini reproductor |

- **Área de arrastre**: solo desde el espacio vacío de la barra superior (no los botones).  
- **Estadísticas**: muestra 👍 y 👎 junto al botón de resolución.

---

## ⚙️ Personalización y persistencia

Todos los ajustes se guardan automáticamente en `localStorage` y se recuperan al recargar la página:

- `enableRatings` – mostrar/ocultar porcentaje de likes en botones flotantes.
- `enableResolution` – mostrar/ocultar etiqueta de resolución en miniaturas.
- `sizeIndex` – tamaño del reproductor (0: pequeño, 1: mediano, 2: grande).
- `thumbBtnPosIndex` – posición del botón flotante (0..7).
- `right` / `bottom` – coordenadas del reproductor (guardadas tras cada arrastre).

Puedes editar manualmente estos valores desde las herramientas de desarrollo (`localStorage`) si lo deseas.

---

## 🔧 Funcionamiento interno

### Obtención de rating (likes / dislikes)
Se utiliza la API pública de **[Return YouTube Dislike](https://returnyoutubedislikeapi.com)**.  
Solicitud: `GET https://returnyoutubedislikeapi.com/votes?videoId={VIDEO_ID}`

### Obtención de resolución
El script extrae la respuesta `ytInitialPlayerResponse` del propio HTML de la página de watch de YouTube y analiza los `formats` para determinar la altura máxima del vídeo.

### Reproductor flotante
- Se inyecta un `<iframe>` que apunta a `https://dragunthor.github.io/mini-player/index.html?id={VIDEO_ID}` (reproductor embebido personalizado).
- Permite reproducción, control de volumen, pantalla completa y persistencia de sesión.

### Detección de miniaturas
Se buscan elementos `<a>` que cumplan con los selectores típicos de YouTube (`/watch?v=`, `/shorts/`, `#thumbnail`).  
Los contenedores se identifican mediante reglas específicas para distintos componentes de YouTube (vídeos de grid, listas de reproducción, shorts, etc.).

---

## ❓ Preguntas frecuentes

**¿El botón aparece también en la página de reproducción activa (`/watch`)?**  
No, se omite intencionadamente para no interferir con el reproductor principal de YouTube.

**¿Puedo cambiar el tamaño y la posición del reproductor?**  
Sí: usa los botones **⤢** (tamaño) y activa el arrastre con **✜** para moverlo.

**¿Por qué a veces la resolución aparece como "?"?**  
Puede deberse a que el vídeo no tiene formatos de vídeo identificables o la solicitud a la API falló. Reintentará en futuras interacciones.

**¿El script afecta al rendimiento?**  
No de forma apreciable. Las peticiones a la API de ratings y resolución se cachean por vídeo y se realizan bajo demanda.

**¿Cómo desactivo por completo las valoraciones o las resoluciones?**  
Haz clic en los botones ⭐ y ? dentro del mini reproductor. La preferencia se guarda.

---

## 🧪 Compatibilidad

- ✅ **Navegadores:** Chrome, Firefox, Edge, Opera (con extensión de usuarioscripts).
- ✅ **YouTube:** versión web moderna (SPA), incluyendo shorts y playlists.
- ✅ **Idiomas:** Español (`es`) e Inglés (`en`) – otros caen a inglés por defecto.

---

## 👥 Créditos

- **Adaptación y optimización:** ChatGPT (modelo de OpenAI).
- **API de valoraciones:** [Return YouTube Dislike](https://returnyoutubedislikeapi.com)
- **Mini reproductor embebido:** [dragunthor/mini-player](https://github.com/dragunthor/mini-player)
- Inspirado en usuarioscripts clásicos de mini reproductor para YouTube.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.  
Eres libre de usarlo, modificarlo y redistribuirlo, siempre que se mantenga el aviso de copyright original.

---

## 🐛 Reportar problemas / Contribuir

Si encuentras algún error o deseas mejorar el script:  
1. Abre un *issue* en este repositorio.  
2. Describe los pasos para reproducir el problema y tu entorno (navegador, versión de YouTube, extensiones instaladas).  
3. Si lo deseas, envía un *pull request* con las correcciones.

---

**¡Disfruta de YouTube sin interrupciones y con toda la información a un clic!** 🚀
