let notes = []; 
let canvas, ctx, isDrawing = false;

// ==========================================
// DEPLOYMENT SETTING
// ==========================================
const API_BASE_URL = 'http://127.0.0.1:5000/api'; 
// const API_BASE_URL = 'https://YOUR_USERNAME.pythonanywhere.com/api'; 

document.addEventListener('DOMContentLoaded', async () => {
    await fetchNotesFromBackend();
    
    document.getElementById('note-content').addEventListener('input', formatBigO);
    document.getElementById('note-form').addEventListener('submit', async (e) => { e.preventDefault(); await saveNote('problem'); });
    document.getElementById('custom-note-form').addEventListener('submit', async (e) => { e.preventDefault(); await saveNote('custom'); });

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('export-toggle')) {
            document.querySelectorAll('.export-menu').forEach(menu => menu.classList.remove('show'));
        }
        const modal = document.getElementById('note-modal');
        if (e.target === modal) closeNoteModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNoteModal();
            hideHoverPreview();
        }
        if (e.ctrlKey && e.key === 'f') {
            const currentTab = document.querySelector('.tab-content.active').id;
            if (currentTab === 'all-notes') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (window.innerWidth > 768) { // Prevent hover previews on mobile devices
            const previewBox = document.getElementById('hover-preview');
            if (previewBox.style.display === 'block') {
                previewBox.style.left = (e.pageX + 20) + 'px';
                previewBox.style.top = (e.pageY + 20) + 'px';
            }
        }
    });

    initWhiteboard();
    setupImageUploader('custom-image-upload', 'custom-content');
    setupImageUploader('note-image-upload', 'note-content');
    setupImagePaste('custom-content');
    setupImagePaste('note-content');
    setupImagePaste('edit-content'); 
});

// --- SIDEBAR TOGGLE LOGIC ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// --- ADVANCED FILTERING & SORTING LOGIC ---
function filterNotes() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    const compFilter = document.getElementById('filter-complexity').value;
    const sortOrder = document.getElementById('sort-date').value;

    let filteredNotes = notes.filter(note => {
        const searchableText = `${note.title} ${note.content} ${note.timeComplexity || ''} ${note.spaceComplexity || ''} ${note.type}`.toLowerCase();
        const matchesSearch = searchableText.includes(query);
        const matchesType = (typeFilter === 'all') || (note.type === typeFilter);
        const matchesComp = (compFilter === 'all') || (note.timeComplexity === compFilter) || (note.spaceComplexity === compFilter);
        return matchesSearch && matchesType && matchesComp;
    });

    filteredNotes.sort((a, b) => {
        const idA = parseInt(a.id);
        const idB = parseInt(b.id);
        return sortOrder === 'desc' ? idB - idA : idA - idB;
    });

    renderNotes(filteredNotes);
}

// --- DATE FORMATTING ---
function formatToIST(utcDateString) {
    if (!utcDateString) return "Date Unknown";
    const date = new Date(utcDateString);
    return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// --- RENDER LOGIC & MARKDOWN PARSING ---
function stripImagesForPreview(text) {
    return text.replace(/!\[.*?\]\(.*?\)/g, '[Image Attached] ');
}

function renderMarkdownImages(text) {
    let html = text.replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width:100%; border-radius:8px; border:1px solid var(--border); margin-top:10px;" />');
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, 
        `<div class="code-block-wrapper">
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
            <pre><code>$2</code></pre>
        </div>`
    );
    return html;
}

function copyCode(btn) {
    const codeBlock = btn.nextElementSibling.innerText;
    navigator.clipboard.writeText(codeBlock).then(() => {
        const originalText = btn.innerText;
        btn.innerText = "Copied!";
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('copied');
        }, 2000);
    });
}

function renderNotes(dataToRender = notes) {
    const allNotesGrid = document.getElementById('all-notes-grid');
    allNotesGrid.innerHTML = '';

    if (dataToRender.length === 0) {
        allNotesGrid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center; margin-top: 2rem;">No notes found matching your criteria.</p>`;
        return;
    }

    dataToRender.forEach(note => {
        let isProblem = note.type === 'problem';
        let tagRow = isProblem
            ? `<span class="tag">⏱ ${note.timeComplexity || 'O(1)'}</span><span class="tag">💾 ${note.spaceComplexity || 'O(1)'}</span>`
            : `<span class="tag">📂 Custom</span>`;

        const card = document.createElement('div');
        card.className = 'note-card';
        card.onclick = () => openNoteModal(note.id);
        
        if (window.innerWidth > 768) {
            card.addEventListener('mouseenter', () => showHoverPreview(note));
            card.addEventListener('mouseleave', hideHoverPreview);
        }

        const safePreviewContent = stripImagesForPreview(note.content);
        const formattedDate = formatToIST(note.dateCreated);

        card.innerHTML = `
            <h3>${note.title}</h3>
            <div class="tag-row">${tagRow}</div>
            <p>${safePreviewContent}</p>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="export-btn export-toggle" onclick="event.stopPropagation(); toggleExportMenu('${note.id}')">Export ▾</button>
                    <div id="export-menu-${note.id}" class="export-menu" onclick="event.stopPropagation();">
                        <button onclick="exportNote('${note.id}', 'pdf')">Export PDF</button>
                        <button onclick="exportNote('${note.id}', 'html')">Export HTML</button>
                        <button onclick="exportNote('${note.id}', 'markdown')">Export MD</button>
                    </div>
                    <button class="export-btn danger-border" onclick="event.stopPropagation(); deleteNote('${note.id}')">Delete</button>
                </div>
                <div class="note-date">${formattedDate}</div>
            </div>
        `;
        allNotesGrid.appendChild(card);
    });
}

// --- API FETCH & DELETE LOGIC ---
async function fetchNotesFromBackend() {
    try {
        const response = await fetch(`${API_BASE_URL}/notes`);
        notes = await response.json();
        filterNotes();
    } catch (error) {
        console.error("Backend not running.", error);
    }
}

async function deleteNote(id) {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/notes/${id}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchNotesFromBackend(); 
            hideHoverPreview(); 
        }
    } catch (error) { alert("Execution failed. Is the Flask backend running?"); }
}

async function deleteAllNotes() {
    if (notes.length === 0) return alert("Your vault is already empty!");
    if (!confirm("WARNING: Are you sure you want to delete ALL notes? This cannot be undone.")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/notes`, { method: 'DELETE' });
        if (response.ok) await fetchNotesFromBackend();
    } catch (error) { alert("Execution failed. Is the Flask backend running?"); }
}

// --- UI ROUTING & SAVING ---
function formatBigO(e) {
    let cursorStart = this.selectionStart;
    let originalLength = this.value.length;
    this.value = this.value.replace(/o\((.*?)\)/gi, (match, p1) => `O(${p1.toUpperCase()})`);
    if (this.value.length !== originalLength) {
        this.selectionStart = this.selectionEnd = cursorStart;
    }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Auto-close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('mobile-overlay').classList.remove('show');
    }

    if (tabId === 'all-notes') {
        setTimeout(() => document.getElementById('search-input').focus(), 100);
    }
}

async function saveNote(type) {
    let payload = { type: type };
    if (type === 'problem') {
        payload.title = document.getElementById('note-title').value;
        payload.timeComplexity = document.getElementById('time-complexity').value;
        payload.spaceComplexity = document.getElementById('space-complexity').value;
        payload.content = document.getElementById('note-content').value;
        document.getElementById('note-form').reset();
        clearWhiteboard();
    } else {
        payload.title = document.getElementById('custom-title').value;
        const rawTopic = document.getElementById('custom-topic').value.trim();
        const rawSubtopic = document.getElementById('custom-subtopic').value.trim();
        const finalTopic = rawTopic === "" ? "General" : rawTopic;
        const finalSubtopic = rawSubtopic === "" ? "Uncategorized" : rawSubtopic;
        const rawContent = document.getElementById('custom-content').value;
        payload.content = `Topic: ${finalTopic} | Subtopic: ${finalSubtopic}\n\n${rawContent}`;
        document.getElementById('custom-note-form').reset();
    }

    try {
        await fetch(`${API_BASE_URL}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await fetchNotesFromBackend(); 
        showTab('all-notes'); 
        document.querySelector("button[onclick=\"showTab('all-notes')\"]").classList.add('active');
    } catch (error) { console.error("Failed to save note", error); }
}

// --- WHITEBOARD & PASTE LOGIC ---
function initWhiteboard() {
    canvas = document.getElementById('whiteboard');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const startPosition = (e) => { isDrawing = true; draw(e); };
    const endPosition = () => { isDrawing = false; ctx.beginPath(); };
    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault(); 
        const pos = getCoordinates(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    canvas.addEventListener('mousedown', startPosition); canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseout', endPosition);
    canvas.addEventListener('touchstart', startPosition, {passive: false});
    canvas.addEventListener('touchend', endPosition); canvas.addEventListener('touchmove', draw, {passive: false});
}

function clearWhiteboard() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

function saveWhiteboardToNote() {
    const dataURL = canvas.toDataURL("image/png");
    const textarea = document.getElementById('note-content');
    textarea.value += `\n![Whiteboard Sketch](${dataURL})\n`;
    clearWhiteboard();
}

function setupImageUploader(inputId, textareaId) {
    document.getElementById(inputId).addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById(textareaId).value += `\n![Uploaded Image](${e.target.result})\n`;
            }
            reader.readAsDataURL(file);
        }
    });
}

function setupImagePaste(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    textarea.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                e.preventDefault(); 
                const reader = new FileReader();
                reader.onload = (event) => {
                    const start = textarea.selectionStart;
                    const text = textarea.value;
                    const pasteText = `\n![Pasted Image](${event.target.result})\n`;
                    textarea.value = text.substring(0, start) + pasteText + text.substring(textarea.selectionEnd);
                    textarea.selectionStart = textarea.selectionEnd = start + pasteText.length;
                };
                reader.readAsDataURL(items[i].getAsFile());
            }
        }
    });
}

// --- MODAL LOGIC & EXECUTION ---
async function runJavaCode(textareaId, outputId) {
    const terminal = document.getElementById(outputId);
    terminal.innerText = "Compiling and Running...";
    terminal.style.color = "#888";
    const content = document.getElementById(textareaId).value;
    const codeMatch = content.match(/```java\n([\s\S]*?)```/);
    if (!codeMatch) {
        terminal.innerText = "Error: Could not find Java code block. Ensure your code is wrapped in ```java ... ```";
        terminal.style.color = "var(--danger)";
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: codeMatch[1] })
        });
        const result = await response.json();
        terminal.innerText = result.output;
        terminal.style.color = result.error ? "var(--danger)" : "#00ff00";
    } catch (error) {
        terminal.innerText = "Execution failed. Is the Flask backend running?";
        terminal.style.color = "var(--danger)";
    }
}

function showHoverPreview(note) {
    const previewBox = document.getElementById('hover-preview');
    let previewContent = stripImagesForPreview(note.content).substring(0, 400);
    if (note.content.length > 400) previewContent += '...\n\n(Click to read more)';
    previewBox.textContent = `${note.title}\n--------------------------\n${previewContent}`;
    previewBox.style.display = 'block';
    setTimeout(() => { previewBox.style.opacity = '1'; }, 10);
}

function hideHoverPreview() {
    const previewBox = document.getElementById('hover-preview');
    previewBox.style.opacity = '0';
    setTimeout(() => { previewBox.style.display = 'none'; }, 200);
}

function toggleExportMenu(id) {
    document.querySelectorAll('.export-menu').forEach(menu => {
        if (menu.id !== `export-menu-${id}`) menu.classList.remove('show');
    });
    document.getElementById(`export-menu-${id}`).classList.toggle('show');
}

function openNoteModal(id) {
    hideHoverPreview();
    const note = notes.find(n => String(n.id) === String(id));
    if (!note) return;

    document.getElementById('modal-title-display').innerText = note.title;
    document.getElementById('modal-meta-display').innerText = note.type === 'problem' 
        ? `Time: ${note.timeComplexity} | Space: ${note.spaceComplexity}` 
        : `Custom Concept Note`;
    document.getElementById('modal-content-display').innerHTML = renderMarkdownImages(note.content);
    
    document.getElementById('modal-raw-content').value = note.content;
    const terminalWrapper = document.getElementById('modal-terminal-wrapper');
    if (note.content.includes("```java")) {
        terminalWrapper.style.display = 'block';
        document.getElementById('modal-terminal-output').innerText = "Awaiting execution...";
        document.getElementById('modal-terminal-output').style.color = "#00ff00";
    } else { terminalWrapper.style.display = 'none'; }

    document.getElementById('edit-note-id').value = note.id;
    document.getElementById('edit-note-type').value = note.type;
    document.getElementById('edit-title').value = note.title;
    document.getElementById('edit-content').value = note.content; 

    if (note.type === 'problem') {
        document.getElementById('edit-meta-problem').style.display = 'flex'; document.getElementById('edit-meta-custom').style.display = 'none';
        document.getElementById('edit-time').value = note.timeComplexity; document.getElementById('edit-space').value = note.spaceComplexity;
    } else {
        document.getElementById('edit-meta-problem').style.display = 'none'; document.getElementById('edit-meta-custom').style.display = 'flex';
        const topicMatch = note.content.match(/Topic: (.*?) \|/); const subtopicMatch = note.content.match(/Subtopic: (.*?)\n/);
        document.getElementById('edit-topic').value = topicMatch ? topicMatch[1] : ''; document.getElementById('edit-subtopic').value = subtopicMatch ? subtopicMatch[1] : '';
        if(topicMatch && subtopicMatch) document.getElementById('edit-content').value = note.content.split('\n\n').slice(1).join('\n\n');
    }
    toggleEditMode(false);
    document.getElementById('note-modal').classList.add('show');
}

function closeNoteModal() {
    document.getElementById('note-modal').classList.remove('show');
    toggleEditMode(false);
}

function toggleEditMode(isEditing) {
    document.getElementById('modal-read-view').style.display = isEditing ? 'none' : 'block';
    document.getElementById('modal-edit-view').style.display = isEditing ? 'block' : 'none';
}

async function saveEditedNote() {
    const id = document.getElementById('edit-note-id').value;
    const type = document.getElementById('edit-note-type').value;
    let payload = { type: type, title: document.getElementById('edit-title').value };

    if (type === 'problem') {
        payload.timeComplexity = document.getElementById('edit-time').value;
        payload.spaceComplexity = document.getElementById('edit-space').value;
        payload.content = document.getElementById('edit-content').value;
    } else {
        const rawTopic = document.getElementById('edit-topic').value.trim() || "General";
        const rawSubtopic = document.getElementById('edit-subtopic').value.trim() || "Uncategorized";
        payload.content = `Topic: ${rawTopic} | Subtopic: ${rawSubtopic}\n\n${document.getElementById('edit-content').value}`;
    }

    try {
        await fetch(`${API_BASE_URL}/notes/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        await fetchNotesFromBackend();
        closeNoteModal();
    } catch (error) { console.error("Failed to update note", error); }
}

// --- EXPORT LOGIC ---
function exportNote(id, format) {
    const note = notes.find(n => String(n.id) === String(id));
    if (!note) return;
    executeExport([note], `${note.title.replace(/\s+/g, '_').toLowerCase()}`, format);
}

function exportAllNotes(format) {
    if (notes.length === 0) return alert("No notes to export!");
    const activeData = Array.from(document.getElementById('all-notes-grid').children).map(card => {
        const title = card.querySelector('h3').innerText;
        return notes.find(n => n.title === title);
    });
    executeExport(activeData, "dsa_vault_export", format);
}

function executeExport(noteArray, filename, format) {
    let content = ''; let mimeType = ''; let fileExtension = '';

    if (format === 'pdf') {
        const element = document.createElement('div');
        element.style.fontFamily = "sans-serif"; element.style.padding = "20px";
        element.style.color = "black"; element.style.background = "white";

        noteArray.forEach((note, index) => {
            let metaString = note.type === 'problem' ? `Time: ${note.timeComplexity} | Space: ${note.spaceComplexity}` : `Custom Note`;
            let parsedContent = renderMarkdownImages(note.content);
            element.innerHTML += `
                <h1 style="margin-bottom: 5px;">${note.title}</h1>
                <p style="color: #666; margin-top: 0;"><strong>${metaString}</strong></p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace;">${parsedContent}</div>
                ${index !== noteArray.length - 1 ? '<hr style="margin: 40px 0; border: 1px solid #ccc;">' : ''}
            `;
        });
        html2pdf().from(element).set({ margin: 10, filename: `${filename}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save();
        return;
    }

    if (format === 'markdown') {
        noteArray.forEach((note, index) => {
            let metaString = note.type === 'problem' ? `Time: ${note.timeComplexity} | Space: ${note.spaceComplexity}` : `Custom Note`;
            content += `# ${note.title}\n\n**${metaString}**\n\n${note.content}\n\n`;
            if (index !== noteArray.length - 1) content += `---\n\n`; 
        });
        mimeType = 'text/markdown'; fileExtension = '.md';
    } else if (format === 'html') {
        content = `<!DOCTYPE html><html><head><title>DSA Vault Export</title></head><body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto;">`;
        noteArray.forEach((note, index) => {
            let metaString = note.type === 'problem' ? `Time: ${note.timeComplexity} | Space: ${note.spaceComplexity}` : `Custom Note`;
            let parsedContent = renderMarkdownImages(note.content);
            content += `<h1>${note.title}</h1><p><strong>${metaString}</strong></p><div style="background: #f4f4f4; padding: 15px;">${parsedContent}</div>`;
            if (index !== noteArray.length - 1) content += `<hr style="margin: 40px 0;">`; 
        });
        content += `</body></html>`; mimeType = 'text/html'; fileExtension = '.html';
    }

    const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${filename}${fileExtension}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
