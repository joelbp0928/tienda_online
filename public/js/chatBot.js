(function () {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const box = document.getElementById('chatMessages');
    const chips = document.querySelectorAll('.quick-chip');

    const scrollToEnd = () => { box.scrollTop = box.scrollHeight; };

    const replyMock = (q) => {
        // Respuestas "fake" para la maqueta
        const map = {
            '¿Costos de envío?': 'CDMX desde $69. Envío gratis en compras mayores a $799.',
            'Guía de tallas': 'Corte unisex regular. S (48cm), M (52cm), L (56cm), XL (60cm) ancho pecho aprox.',
            'Estado de mi pedido': 'Comparte tu número de pedido (ej: #TIENDA-1234) y te digo el estatus 😉'
        };
        return map[q] || 'Gracias por tu mensaje 🙌. En breve un asesor te responde.';
    };

    const push = (text, who = 'me') => {
        const div = document.createElement('div');
        div.className = `msg ${who}`;
        div.textContent = text;
        box.appendChild(div);
        scrollToEnd();
    };

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = (input.value || '').trim();
        if (!v) return;
        push(v, 'me');
        input.value = '';
        setTimeout(() => push(replyMock(v), 'bot'), 500);
    });

    chips.forEach(c => c.addEventListener('click', () => {
        const q = c.getAttribute('data-q');
        push(q, 'me');
        setTimeout(() => push(replyMock(q), 'bot'), 350);
    }));
})();
