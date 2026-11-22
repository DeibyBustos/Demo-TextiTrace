# TextiTrace — Prototipo funcional

Aplicación funcional (no solo mockup) que implementa el flujo completo descrito en el
Entregable 2: registro de entregas con QR, escaneo y clasificación, traspaso en dos pasos
con umbral de discrepancia del 5%, división de lotes con validación de balance de masa,
mezcla de lotes por ruta de aprovechamiento, historial/genealogía append-only, y un panel
de indicadores de solo lectura para el rol Entidad.

**No incluye IA, blockchain ni sensores IoT**, de forma consistente con la decisión del
equipo de no sobre-ingeniería del MVP.

## Stack

- **Frontend:** React + Vite (sin frameworks extra), paleta y tipografía tomadas del
  mockup de Figma del equipo.
- **Backend:** Node.js + Express, con `node:sqlite` (módulo nativo de Node 22, sin
  dependencias externas que compilar) como base de datos de un solo archivo.
- **Un solo servicio:** Express sirve tanto la API (`/api/*`) como el build de React, así
  que solo hay que desplegar una cosa y queda un único link público.

## Correr en local

Requiere Node.js 22.5 o superior (incluye `node:sqlite`).

```bash
npm install
npm run build      # compila el frontend (client/dist)
npm start          # levanta el servidor en http://localhost:3000
```

Abre `http://localhost:3000` y sigue el guion de demo (ver abajo).

Para desarrollo con recarga en caliente del frontend, en dos terminales:

```bash
npm start                      # terminal 1: backend en :3000
cd client && npm install && npm run dev   # terminal 2: frontend en :5173 (con proxy a :3000)
```

## Guion de demo (igual al §5.3 del Entregable 2)

1. Entrar como **Operador** → crear una entrega de 100 kg → se genera el lote y su QR.
2. "Escanear" el QR (se simula automáticamente) → clasificar la ruta de aprovechamiento →
   continuar hacia el traspaso.
3. **Traspaso paso 1** (emisor): enviar el lote a un gestor.
   Cambiar de rol a **Gestor** → **Traspaso paso 2** (receptor): aceptar con el peso
   verificado. Si la diferencia supera el 5%, la app obliga a elegir entre "aceptar con
   observación" o "rechazar" (no deja aceptar en silencio).
4. **Dividir** el lote en dos lotes hijos + merma. Si la suma no cuadra con el peso
   original, el sistema rechaza la división y explica por qué (probarlo a propósito).
5. **Mezclar** dos lotes con la misma ruta de aprovechamiento → se crea un lote nuevo que
   conserva el vínculo con ambos orígenes.
6. Abrir el **historial** del lote resultante → se ve la genealogía completa, evento por
   evento (nunca se edita ni se borra nada).
7. Cambiar a rol **Entidad (solo lectura)** → revisar el **panel de indicadores**
   (kg recolectados/clasificados, % por ruta, lotes sin destino, alertas de discrepancia,
   kg por punto de recolección).

## Desplegar con un link público (Render, gratis)

1. Sube esta carpeta a un repositorio de GitHub (puede ser privado).
2. Entra a [render.com](https://render.com) → *New* → *Web Service* → conecta ese
   repositorio.
3. Configuración:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Node version:** se detecta sola por el archivo `.node-version` (22), pero si Render
     pregunta, usa 22 o superior.
4. Deploy. Render te da un link público tipo `https://textitrace.onrender.com` que
   cualquiera puede abrir desde su navegador (celular o computador), sin instalar nada.

**Nota sobre persistencia:** en el plan gratis de Render el servicio "duerme" tras un rato
de inactividad y el archivo `.sqlite` se reinicia en cada redeploy (no hay disco
persistente en el plan free). Para la presentación esto no es un problema: el servicio
se mantiene activo mientras lo estás usando en vivo. Si quieren que los datos de la demo
sobrevivan entre sesiones, se puede agregar un *persistent disk* de Render (plan pago) o
cambiar `DB_PATH` a una base de datos gestionada — no es necesario para el entregable.

## Estructura

```
server/   → Express + node:sqlite (modelo de datos, reglas de negocio, API REST)
client/   → React + Vite (las mismas pantallas del prototipo de Figma, ahora funcionales)
```
