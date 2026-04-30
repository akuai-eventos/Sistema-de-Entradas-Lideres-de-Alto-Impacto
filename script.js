document.addEventListener("DOMContentLoaded", function () {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  cargarTasaBCV();
  cargarStockVisual();
  iniciarStockEnTiempoReal();
  actualizarResumenPedido();
  inicializarEventosVisuales();
  actualizarHora();
  setInterval(actualizarHora, 1000);
});

/*
  IMPORTANTE:
  Si usas el mismo Apps Script de las arepas y solo reemplazas Code.gs, normalmente puedes dejar esta URL.
  Si creas una nueva implementación, pega aquí la URL nueva de la Web App.
*/
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz7OyV5uOFJO34L9E74mTsrWyLzkPrBipwsToQlNY5Ug758Pk5vW-GS4fENMSbWOivB/exec";

const PRECIO_ENTRADA_USD = 5;
const MAX_ENTRADAS_POR_REGISTRO = 5;
const TOTAL_INICIAL_ENTRADAS = 300;

let TASA_BCV = 0;
let ultimoStockEntradas = null;
let intervaloStock = null;
let registroPendiente = null;

const form = document.getElementById("akuaiForm");
const modalConfirm = document.getElementById("modal-confirm");
const modalSuccess = document.getElementById("modal-success");
const modalMessage = document.getElementById("modal-message");

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function mostrarMensaje(texto, titulo = "Akuai Eventos") {
  setText("message-title", titulo);
  setText("message-text", texto);
  if (modalMessage) modalMessage.style.display = "grid";
}

function cerrarMensaje() {
  if (modalMessage) modalMessage.style.display = "none";
}

function formatoBs(monto) {
  return Number(monto || 0).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatoUsd(monto) {
  return Number(monto || 0).toFixed(2);
}

function obtenerFechaRegistro() {
  return new Date().toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function limpiarNombreArchivo(texto) {
  return String(texto || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");
}

function mostrarFormulario() {
  const wrapper = document.getElementById("form-wrapper");
  const cta = document.getElementById("cta-content");
  const registro = document.getElementById("registro");

  if (wrapper) wrapper.style.display = "block";
  if (cta) cta.style.display = "none";
  if (registro) registro.scrollIntoView({ behavior: "smooth" });

  cargarTasaBCV();
  cargarStockVisual();
  iniciarStockEnTiempoReal();
  actualizarResumenPedido();
}

function cerrarFormulario() {
  const wrapper = document.getElementById("form-wrapper");
  const cta = document.getElementById("cta-content");

  if (wrapper) wrapper.style.display = "none";
  if (cta) cta.style.display = "block";
}


async function cargarStockVisual() {
  try {
    setText("stock-message", "Cargando disponibilidad de entradas...");

    const response = await fetch(`${WEB_APP_URL}?action=stock`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "No se pudo cargar la disponibilidad.");
    }

    const tieneStockEntradas =
      data.disponible !== undefined ||
      (data.stock && data.stock.Entradas !== undefined);

    if (!tieneStockEntradas) {
      throw new Error("La Web App todavía está devolviendo el stock viejo de arepas. Debes publicar una nueva versión del Apps Script.");
    }

    const inicial = Number(data.inicial || TOTAL_INICIAL_ENTRADAS || 300);
    const disponibles = Number(
      data.disponible !== undefined
        ? data.disponible
        : data.stock.Entradas
    );

    const vendidas = Math.max(0, inicial - disponibles);
    const porcentaje = inicial > 0
      ? Math.max(0, Math.min(100, (vendidas / inicial) * 100))
      : 0;

    const barra = document.getElementById("stock-progress-fill");
    const formEl = document.getElementById("akuaiForm");

    if (data.cerrado || disponibles <= 0) {
      if (formEl) formEl.style.display = "none";

      setText("stock-message", "🔥 REGISTRO CERRADO - ENTRADAS AGOTADAS");
      setText("stock-progress-text", "AGOTADO");
      setText("entradas-disponibles-inline", "Disponibles: 0 entradas");

      if (barra) {
        barra.style.width = "100%";
        barra.style.background = "#c62828";
      }

      return;
    }

    if (formEl) formEl.style.display = "block";

    let textoBarra = "";

    if (disponibles <= 10) {
      textoBarra = `⚠️ Últimas ${disponibles} entradas`;
    } else {
      textoBarra = `${disponibles} disponibles de ${inicial}`;
    }

    setText("stock-progress-text", textoBarra);
    setText("stock-message", "Disponibilidad actualizada en tiempo real.");
    setText("entradas-disponibles-inline", `Disponibles: ${disponibles} entradas`);

    if (barra) {
      barra.style.width = "0%";

      setTimeout(() => {
        barra.style.width = `${porcentaje}%`;

        if (porcentaje >= 85) {
          barra.style.background = "#c62828";
        } else if (porcentaje >= 55) {
          barra.style.background = "#f9a825";
        } else {
          barra.style.background = "#2e7d32";
        }
      }, 200);
    }

    if (ultimoStockEntradas !== null && disponibles < ultimoStockEntradas) {
      animarVentaDetectada(ultimoStockEntradas - disponibles);
    }

    ultimoStockEntradas = disponibles;

  } catch (error) {
    console.warn("Error cargando disponibilidad:", error);
    setText("stock-message", "No se pudo cargar la disponibilidad. Revisa la implementación del Apps Script.");
    setText("stock-progress-text", "No disponible");
    setText("entradas-disponibles-inline", "Disponibles: no disponible");
  }
}

function iniciarStockEnTiempoReal() {
  if (intervaloStock) clearInterval(intervaloStock);

  intervaloStock = setInterval(() => {
    cargarStockVisual();
  }, 15000);
}

function animarVentaDetectada(cantidad) {
  const mensaje = document.getElementById("stock-hype-message");

  if (!mensaje) return;

  mensaje.textContent = cantidad === 1
    ? "¡1 entrada reservada!"
    : `¡${cantidad} entradas reservadas!`;

  mensaje.classList.remove("show");
  void mensaje.offsetWidth;
  mensaje.classList.add("show");

  setTimeout(() => {
    mensaje.classList.remove("show");
  }, 2800);
}

async function cargarTasaBCV() {
  try {
    setText("tasa-bcv-text", "Cargando...");
    setText("total-bs-text", "Cargando...");

    const response = await fetch(`${WEB_APP_URL}?action=bcv`);
    const data = await response.json();

    if (data.ok && Number(data.tasa) > 0) {
      TASA_BCV = Number(data.tasa);
    } else {
      TASA_BCV = 0;
    }
  } catch (error) {
    console.warn("Error cargando tasa:", error);
    TASA_BCV = 0;
  }

  actualizarResumenPedido();
}

function cambiarCantidadEntradas(cambio) {
  const input = document.getElementById("f-cantidad-entradas");
  let valorActual = Number(input.value || 1);
  let nuevoValor = valorActual + cambio;

  if (nuevoValor < 1) nuevoValor = 1;

  if (nuevoValor > MAX_ENTRADAS_POR_REGISTRO) {
    mostrarMensaje(`Puedes registrar máximo ${MAX_ENTRADAS_POR_REGISTRO} personas por grupo, incluyendo a la primera persona.`);
    nuevoValor = MAX_ENTRADAS_POR_REGISTRO;
  }

  input.value = nuevoValor;
  renderIntegrantesAdicionales(nuevoValor);
  actualizarResumenPedido();
}

function renderIntegrantesAdicionales(cantidadTotal) {
  const wrapper = document.getElementById("integrantes-wrapper");
  if (!wrapper) return;

  wrapper.innerHTML = "";

  if (cantidadTotal <= 1) {
    return;
  }

  const titulo = document.createElement("div");
  titulo.className = "section-title-form";
  titulo.textContent = "Datos de integrantes adicionales";
  wrapper.appendChild(titulo);

  const ayuda = document.createElement("p");
  ayuda.className = "helper-text group-helper";
  ayuda.textContent = "Completa los datos de cada persona adicional. Cada participante tendrá su propio QR.";
  wrapper.appendChild(ayuda);

  for (let i = 2; i <= cantidadTotal; i++) {
    const card = document.createElement("div");
    card.className = "integrante-card";
    card.innerHTML = `
      <h4>Participante ${i}</h4>

      <div class="form-grid">
        <div class="question-box">
          <label>Nombre y Apellido <span>*</span></label>
          <input type="text" id="integrante-${i}-nombre" class="input-field integrante-nombre" required placeholder="Nombre y Apellido">
        </div>

        <div class="question-box">
          <label>Cédula <span>*</span></label>
          <input type="text" id="integrante-${i}-cedula" class="input-field integrante-cedula" required placeholder="V-00000000">
        </div>

        <div class="question-box">
          <label>WhatsApp <span>*</span></label>
          <input type="tel" id="integrante-${i}-whatsapp" class="input-field integrante-whatsapp" required placeholder="04xx-xxxxxxx">
        </div>

        <div class="question-box">
          <label>Email <span>*</span></label>
          <input type="email" id="integrante-${i}-email" class="input-field integrante-email" required placeholder="correo@ejemplo.com">
        </div>

        <div class="question-box">
          <label>Categoría <span>*</span></label>
          <select id="integrante-${i}-categoria" class="input-field integrante-categoria" required>
            <option value="">Selecciona una categoría</option>
            <option value="Público General">Público General</option>
            <option value="Coordinador HELAV">Coordinador HELAV</option>
            <option value="Personal HELAV">Personal HELAV</option>
            <option value="Otro">Otro</option>
            <option value="Patrocinante">Patrocinante</option>
          </select>
        </div>
      </div>
    `;

    wrapper.appendChild(card);
  }
}

function actualizarResumenPedido() {
  const cantidad = Number(document.getElementById("f-cantidad-entradas")?.value || 1);
  const totalUsd = cantidad * PRECIO_ENTRADA_USD;
  const totalBs = totalUsd * TASA_BCV;
  const modalidad = cantidad > 1 ? "Grupal" : "Individual";

  setText("precio-entrada-card", PRECIO_ENTRADA_USD);
  setText("precio-entrada-text", formatoUsd(PRECIO_ENTRADA_USD));
  setText("entradas-total-text", cantidad);
  setText("modalidad-text", modalidad);
  setText("total-usd-text", formatoUsd(totalUsd));

  if (TASA_BCV > 0) {
    setText("tasa-bcv-text", formatoBs(TASA_BCV));
    setText("total-bs-text", formatoBs(totalBs));
  } else {
    setText("tasa-bcv-text", "--");
    setText("total-bs-text", "--");
  }
}

function mostrarDatosPago() {
  const metodo = document.getElementById("f-metodo")?.value;
  const bloque = document.getElementById("bloque-datos-pago");
  const datos = document.getElementById("datos-pago");

  if (!bloque || !datos) return;

  if (metodo === "Pago móvil" || metodo === "Transferencia") {
    bloque.classList.remove("payment-hidden");
  } else {
    bloque.classList.add("payment-hidden");
    datos.classList.remove("datos-pago-open");
  }
}

function togglePago() {
  const datos = document.getElementById("datos-pago");
  if (datos) datos.classList.toggle("datos-pago-open");
}

function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function obtenerParticipantes() {
  const cantidad = Number(document.getElementById("f-cantidad-entradas").value || 1);
  const participantes = [];

  participantes.push({
    nombre: document.getElementById("f-nombre").value.trim(),
    cedula: document.getElementById("f-cedula").value.trim(),
    whatsapp: document.getElementById("f-whatsapp").value.trim(),
    email: document.getElementById("f-email").value.trim(),
    categoria: document.getElementById("f-categoria").value.trim()
  });

  for (let i = 2; i <= cantidad; i++) {
    participantes.push({
      nombre: document.getElementById(`integrante-${i}-nombre`).value.trim(),
      cedula: document.getElementById(`integrante-${i}-cedula`).value.trim(),
      whatsapp: document.getElementById(`integrante-${i}-whatsapp`).value.trim(),
      email: document.getElementById(`integrante-${i}-email`).value.trim(),
      categoria: document.getElementById(`integrante-${i}-categoria`).value.trim()
    });
  }

  return participantes;
}

function validarParticipantes(participantes) {
  const cedulas = new Set();
  const emails = new Set();

  for (let i = 0; i < participantes.length; i++) {
    const p = participantes[i];
    const numero = i + 1;

    if (!p.nombre) return `Falta el nombre del participante ${numero}.`;
    if (!p.cedula) return `Falta la cédula del participante ${numero}.`;
    if (!p.whatsapp) return `Falta el WhatsApp del participante ${numero}.`;
    if (!p.email) return `Falta el email del participante ${numero}.`;
    if (!p.categoria) return `Falta la categoría del participante ${numero}.`;

    const cedulaKey = p.cedula.toLowerCase().replace(/\s+/g, "");
    const emailKey = p.email.toLowerCase().replace(/\s+/g, "");

    if (cedulas.has(cedulaKey)) {
      return `La cédula del participante ${numero} está repetida dentro del mismo registro.`;
    }

    if (emails.has(emailKey)) {
      return `El email del participante ${numero} está repetido dentro del mismo registro.`;
    }

    cedulas.add(cedulaKey);
    emails.add(emailKey);
  }

  return "";
}

if (form) {
  form.onsubmit = async function (e) {
    e.preventDefault();

    const cantidad = Number(document.getElementById("f-cantidad-entradas").value || 1);
    const modalidad = cantidad > 1 ? "Grupal" : "Individual";
    const asesor = document.getElementById("f-asesor").value.trim();
    const metodo = document.getElementById("f-metodo").value;
    const referencia = document.getElementById("f-referencia").value.trim();
const capture = document.getElementById("f-capture").files[0];

if (capture && capture.size > 3 * 1024 * 1024) {
  return mostrarMensaje("El comprobante es muy pesado. Por favor sube una imagen menor a 3 MB.");
}    
    const participantes = obtenerParticipantes();
    const totalUsd = cantidad * PRECIO_ENTRADA_USD;
    const totalBs = totalUsd * TASA_BCV;

    if (cantidad < 1 || cantidad > MAX_ENTRADAS_POR_REGISTRO) {
      return mostrarMensaje(`La cantidad de entradas debe estar entre 1 y ${MAX_ENTRADAS_POR_REGISTRO}.`);
    }

    const errorParticipantes = validarParticipantes(participantes);
    if (errorParticipantes) return mostrarMensaje(errorParticipantes);

    if (!asesor) return mostrarMensaje("Coloca el nombre del asesor.");
    if (!metodo) return mostrarMensaje("Selecciona un método de pago.");
    if (!referencia) return mostrarMensaje("Coloca la referencia de pago.");
    if (!capture) return mostrarMensaje("Debes subir el capture o comprobante de pago.");

    const extension = capture.name.includes(".")
      ? capture.name.substring(capture.name.lastIndexOf("."))
      : "";

    const referenciaLimpia = limpiarNombreArchivo(referencia);
    const nombreCaptureConReferencia = `${referenciaLimpia}_comprobante${extension}`;

    registroPendiente = {
      fecha: obtenerFechaRegistro(),
      participantes: participantes,
      asesor: asesor,
      modalidad: modalidad,
      cantidad_entradas: cantidad,
      precio_entrada_usd: PRECIO_ENTRADA_USD,
      total_usd: formatoUsd(totalUsd),
      tasa: TASA_BCV,
      total_bs: TASA_BCV > 0 ? formatoBs(totalBs) : "",
      metodo: metodo,
      referencia: referencia,
      capture_nombre: nombreCaptureConReferencia,
      capture_tipo: capture.type || "application/octet-stream",
      capture_base64: await archivoABase64(capture)
    };

    setText("confirm-name", participantes[0].nombre);
    setText("confirm-email", participantes[0].email);
    setText("confirm-modalidad", modalidad);
    setText("confirm-cantidad", cantidad);
    setText("confirm-asesor", asesor);
    setText("confirm-metodo", metodo);
    setText("confirm-referencia", referencia);
    setText("confirm-capture", nombreCaptureConReferencia);
    setText("confirm-total-usd", `$${formatoUsd(totalUsd)}`);
    setText("confirm-tasa-bcv", TASA_BCV > 0 ? `Bs ${formatoBs(TASA_BCV)}` : "No disponible");
    setText("confirm-total-bs", TASA_BCV > 0 ? `Bs ${formatoBs(totalBs)}` : "No disponible");

    modalConfirm.style.display = "grid";
  };
}

function cerrarConfirm() {
  if (modalConfirm) modalConfirm.style.display = "none";
}

async function enviarRegistro() {
  console.log("CLICK EN ENVIAR REGISTRO");
    if (!registroPendiente) {
    mostrarMensaje("No hay un registro pendiente.");
    return;
  }

  try {
    const boton = document.querySelector("#modal-confirm .btn-confirm");
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Guardando...";
    }

    const datos = new URLSearchParams();
    datos.append("action", "reservar");
    datos.append("fecha", registroPendiente.fecha);
    datos.append("personas_json", JSON.stringify(registroPendiente.participantes));    
    datos.append("asesor", registroPendiente.asesor);
    datos.append("modalidad", registroPendiente.modalidad);
    datos.append("cantidad_entradas", registroPendiente.cantidad_entradas);
    datos.append("precio_entrada_usd", registroPendiente.precio_entrada_usd);
    datos.append("total_usd", registroPendiente.total_usd);
    datos.append("tasa", registroPendiente.tasa);
    datos.append("total_bs", registroPendiente.total_bs);
    datos.append("metodo", registroPendiente.metodo);
    datos.append("referencia", registroPendiente.referencia);
    datos.append("capture", registroPendiente.capture_nombre);
    datos.append("capture_nombre", registroPendiente.capture_nombre);
    datos.append("capture_tipo", registroPendiente.capture_tipo);
    datos.append("capture_base64", registroPendiente.capture_base64);

console.log("WEB_APP_URL:", WEB_APP_URL);
console.log("Datos enviados:", Array.from(datos.entries()));

const response = await fetch(WEB_APP_URL, {
  method: "POST",
  body: datos
});

console.log("Status respuesta:", response.status);
console.log("URL final respuesta:", response.url);

const textoRespuesta = await response.text();
console.log("Respuesta Apps Script:", textoRespuesta);

let data;
try {
  data = JSON.parse(textoRespuesta);
} catch (err) {
  throw new Error("Apps Script no devolvió JSON válido. Respuesta: " + textoRespuesta.slice(0, 250));
}

    if (!data.ok) {
      throw new Error(data.error || "No se pudo guardar el registro.");
    }

    if (modalConfirm) modalConfirm.style.display = "none";
    if (modalSuccess) modalSuccess.style.display = "grid";

    form.reset();
    document.getElementById("f-cantidad-entradas").value = 1;
    renderIntegrantesAdicionales(1);
    actualizarResumenPedido();
    cargarStockVisual();

  } catch (error) {
    mostrarMensaje("Error al guardar el registro: " + error.message, "No se pudo guardar");
  } finally {
    const boton = document.querySelector("#modal-confirm .btn-confirm");
    if (boton) {
      boton.disabled = false;
      boton.textContent = "Sí, registrar";
    }
  }
}

function cerrarExito() {
  if (modalSuccess) modalSuccess.style.display = "none";
  registroPendiente = null;
  cerrarFormulario();
}

function inicializarEventosVisuales() {
  const header = document.querySelector("header");
  let headerH = header ? header.offsetHeight : 0;

  window.addEventListener("resize", function () {
    headerH = header ? header.offsetHeight : 0;
  });

  window.addEventListener("scroll", function () {
    reveal();

    if (!header) return;

    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    if (window.scrollY > headerH) {
      header.classList.add("is-sticky");
      document.body.style.paddingTop = headerH + "px";
    } else {
      header.classList.remove("is-sticky");
      document.body.style.paddingTop = "0px";
    }
  });

  reveal();
}

function reveal() {
  const reveals = document.querySelectorAll(".reveal");

  for (let i = 0; i < reveals.length; i++) {
    const windowHeight = window.innerHeight;
    const elementTop = reveals[i].getBoundingClientRect().top;
    const elementVisible = 150;

    if (elementTop < windowHeight - elementVisible) {
      reveals[i].classList.add("active");
    }
  }
}

function actualizarHora() {
  const ahora = new Date();
  const horas = ahora.getHours().toString().padStart(2, "0");
  const minutos = ahora.getMinutes().toString().padStart(2, "0");
  const reloj = document.getElementById("phone-clock");

  if (reloj) reloj.textContent = `${horas}:${minutos}`;
}
