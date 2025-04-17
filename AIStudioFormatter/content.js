console.log("AI Studio JSON Formatter v1.3: Content script loaded.");

// --- Configuración ---
const TARGET_JSON_STRUCTURE = {
    keys: [
        "step",
        "title",
        "wait_for_user_to_do_the_step and ask to continue with next step"
    ]
};
const INSTRUCTIONS_KEY = "wait_for_user_to_do_the_step and ask to continue with next step";

// --- Estilos Tema Oscuro ---
const DARK_THEME = {
    background: '#1e1e1e',
    text: '#e8e9f0',
    title: '#e8e9f0', // O un azul claro si prefieres: '#66b3ff'
    border: '#444444'
};

// --- Lógica Principal ---

function isValidJsonStructure(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    return TARGET_JSON_STRUCTURE.keys.every(key => data.hasOwnProperty(key));
}

function formatJsonAsHtml(data) {
    const container = document.createElement('div');
    container.style.padding = '15px';
    container.style.border = `1px solid ${DARK_THEME.border}`;
    container.style.borderRadius = '8px';
    container.style.marginTop = '10px';
    container.style.backgroundColor = DARK_THEME.background;
    container.style.color = DARK_THEME.text;
    container.style.fontFamily = 'inherit';
    container.style.lineHeight = '1.6';
    container.classList.add('json-formatted-container');

    const title = document.createElement('h3');
    title.textContent = data.title || `Paso ${data.step}`;
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';
    title.style.color = DARK_THEME.title;
    title.style.fontWeight = '600';

    const instructions = document.createElement('div');
    const rawMarkdown = data[INSTRUCTIONS_KEY] || 'No se encontraron instrucciones.';

    if (typeof marked !== 'undefined') {
        try {
            marked.setOptions({ breaks: true, gfm: true });
            instructions.innerHTML = marked.parse(rawMarkdown);
        } catch(e) {
            console.error("AI Studio JSON Formatter: Error parsing Markdown", e);
            instructions.textContent = rawMarkdown;
            instructions.style.whiteSpace = 'pre-wrap';
        }
    } else {
        console.warn("AI Studio JSON Formatter: marked.js library not found. Displaying plain text.");
        instructions.textContent = rawMarkdown;
        instructions.style.whiteSpace = 'pre-wrap';
    }

    // Aplicar estilos post-markdown
    instructions.querySelectorAll('strong, b').forEach(el => el.style.fontWeight = 'bold');
    instructions.querySelectorAll('em, i').forEach(el => el.style.fontStyle = 'italic');
    instructions.querySelectorAll('a').forEach(el => el.style.color = '#8ab4f8');
    instructions.querySelectorAll('code').forEach(el => {
        el.style.backgroundColor = '#333';
        el.style.padding = '2px 5px';
        el.style.borderRadius = '4px';
        el.style.fontFamily = 'monospace';
    });
     instructions.querySelectorAll('ul, ol').forEach(el => {
         el.style.paddingLeft = '25px';
         el.style.marginTop = '5px';
         el.style.marginBottom = '10px';
     });
      instructions.querySelectorAll('li').forEach(el => {
         el.style.marginBottom = '5px';
     });

    container.appendChild(title);
    container.appendChild(instructions);

    return container;
}

// Función de procesamiento actualizada con el selector correcto
function processNode(nodeToScan) {
    if (!nodeToScan || typeof nodeToScan.querySelectorAll !== 'function') {
        return;
    }

    // *** USA EL SELECTOR BASADO EN LA INSPECCIÓN ***
    // Busca <code> dentro de <pre> dentro de <ms-code-block>
    const potentialJsonHolders = nodeToScan.querySelectorAll('ms-code-block pre code');

    // Log para ver si encuentra algo con el nuevo selector
    if (potentialJsonHolders.length > 0) {
        console.log(`AI Studio JSON Formatter: Scanning node, found ${potentialJsonHolders.length} potential holders using 'ms-code-block pre code'. Node:`, nodeToScan);
    }


    potentialJsonHolders.forEach((holder, index) => {
        // Log de cada elemento encontrado
        // console.log(`AI Studio JSON Formatter: Checking holder #${index}:`, holder);

        // El elemento 'holder' ahora es el <code>. Necesitamos reemplazar su contenedor <ms-code-block>.
        const codeBlockContainer = holder.closest('ms-code-block');

        // Evitar reprocesar si el contenedor ms-code-block ya fue reemplazado o marcado
        if (!codeBlockContainer || codeBlockContainer.classList.contains('json-formatter-processed') || codeBlockContainer.closest('.json-formatted-container') ) {
            // console.log(`   -> Skipping holder #${index}: Already processed or inside formatted container.`);
            return;
        }


        const textContent = holder.textContent.trim();
        // console.log(`   -> Holder #${index} textContent (trimmed): "${textContent.substring(0, 100)}..."`);

        let jsonData;
        let isPotentialJson = textContent.startsWith('{') && textContent.endsWith('}');
        // console.log(`   -> Holder #${index} looks like JSON? ${isPotentialJson}`);

        if (!isPotentialJson) {
            // console.log(`   -> Skipping holder #${index}: Does not start/end with {}.`);
            return;
        }

        try {
            // Limpieza adicional: A veces hay caracteres invisibles (como ZWSP) pegados.
            // Esto es un intento de eliminarlos antes de parsear.
            const cleanTextContent = textContent.replace(/[\u200B-\u200D\uFEFF]/g, '');
            jsonData = JSON.parse(cleanTextContent);
        } catch (e) {
            console.log(`   -> Skipping holder #${index}: Failed to parse JSON. Error:`, e.message);
            return;
        }

        // console.log(`   -> Holder #${index} parsed JSON data:`, jsonData);
        let hasCorrectStructure = isValidJsonStructure(jsonData);
        // console.log(`   -> Holder #${index} has correct structure? ${hasCorrectStructure}`);

        if (hasCorrectStructure) {
            console.log(`   -> SUCCESS: Found target JSON structure in holder #${index}. Attempting to format.`);
            const formattedHtml = formatJsonAsHtml(jsonData);

            // Elemento a reemplazar: el <ms-code-block> completo
            const targetElementToReplace = codeBlockContainer;
            console.log(`   -> Element to replace:`, targetElementToReplace);

            if (targetElementToReplace && targetElementToReplace.parentElement) {
                 targetElementToReplace.parentElement.replaceChild(formattedHtml, targetElementToReplace);
                 console.log(`   -> Replaced target element with formatted HTML.`);
                 // Marcamos el contenedor ms-code-block como procesado para evitar futuros intentos
                 // (aunque ya no esté en el DOM, el nodo original podría persistir en memoria brevemente)
                 codeBlockContainer.classList.add('json-formatter-processed');
            } else {
                console.warn(`   -> FAILED REPLACE: Could not find suitable element or parent to replace for holder #${index}:`, holder);
            }
        } else {
             // console.log(`   -> Skipping holder #${index}: JSON structure did not match.`);
        }
    });
}

// --- VERSIÓN SIMPLIFICADA DEL OBSERVADOR (Funciona mejor en pruebas iniciales) ---
const observer = new MutationObserver((mutationsList) => {
    let processed = false; // Para evitar múltiples llamadas a processNode si hay muchas mutaciones juntas
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Si se añadieron nodos, simplemente volvemos a escanear todo el body.
            // Es menos eficiente, pero más fiable para capturar estructuras complejas añadidas.
            processed = true;
            break; // Salir del bucle de mutaciones si ya sabemos que necesitamos procesar
        }
    }
    if (processed) {
        // console.log("AI Studio JSON Formatter: Mutation detected, re-scanning document.body");
        // Damos un respiro mínimo para que el DOM se asiente completamente
        setTimeout(() => processNode(document.body), 100); // 100ms de retraso
    }
});

// Empezar a observar directamente el body
console.log("AI Studio JSON Formatter: Observing document.body.");
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Procesar contenido inicial
console.log("AI Studio JSON Formatter: Running initial check on existing content.");
// Esperar un poco más al inicio por si la carga es lenta
setTimeout(() => processNode(document.body), 500); // 500ms de retraso inicial