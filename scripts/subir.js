const dropzone = document.getElementById('dropzone');

// Función para convertir archivo a base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remover el prefijo "data:application/...;base64,"
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Manejar drop de archivos
dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.style.backgroundColor = '#f0f0f0';
    
    const archivo = e.dataTransfer.files[0];
    
    // Validar que sea un Excel
    if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        alert('❌ Por favor subí un archivo Excel (.xlsx o .xls)');
        return;
    }
    
    // Mostrar estado de carga
    dropzone.innerHTML = `
        <div>📤 Subiendo ${archivo.name}...</div>
        <div style="font-size: 12px; margin-top: 10px;">Esto puede tardar unos segundos</div>
    `;
    
    try {
        // Solicitar token al usuario (más seguro que hardcodearlo)
        let token = localStorage.getItem('github_token');
        if (!token) {
            token = prompt('Ingresá tu GitHub Personal Access Token:');
            if (!token) {
                dropzone.innerHTML = 'Soltá el archivo Excel acá';
                return;
            }
            // Guardar para próximas veces (opcional)
            if (confirm('¿Guardar token para próximas veces?')) {
                localStorage.setItem('github_token', token);
            }
        }
        
        const repo = 'salpasistemas/import-pedidos';
        const path = `uploaded/${archivo.name}`;
        const branch = 'main';
        
        // Convertir archivo a base64
        const base64Content = await fileToBase64(archivo);
        
        // Subir archivo a GitHub
        const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Subir pedidos: ${archivo.name}`,
                content: base64Content,
                branch: branch
            })
        });
        
        if (response.ok) {
            dropzone.innerHTML = `
                <div style="color: green;">✅ ¡Archivo subido correctamente!</div>
                <div style="font-size: 12px; margin-top: 10px;">
                    La GitHub Action se ejecutará automáticamente<br>
                    Revisá la pestaña "Actions" en el repo
                </div>
            `;
            
            // Abrir pestaña Actions automáticamente
            setTimeout(() => {
                window.open(`https://github.com/${repo}/actions`, '_blank');
            }, 2000);
            
        } else {
            const error = await response.json();
            throw new Error(`Error ${response.status}: ${error.message}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
        dropzone.innerHTML = `
            <div style="color: red;">❌ Error al subir archivo</div>
            <div style="font-size: 12px; margin-top: 10px;">
                ${error.message}<br>
                <button onclick="location.reload()">Intentar de nuevo</button>
            </div>
        `;
    }
});

// Manejar drag over
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.backgroundColor = '#e8f5e8';
    dropzone.style.borderColor = '#4CAF50';
});

// Manejar drag leave
dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.backgroundColor = '';
    dropzone.style.borderColor = '#888';
});

// También permitir clic para seleccionar archivo
dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Simular drop event
            const dropEvent = new DragEvent('drop');
            dropEvent.dataTransfer = { files: [file] };
            dropzone.dispatchEvent(dropEvent);
        }
    };
    input.click();
});
