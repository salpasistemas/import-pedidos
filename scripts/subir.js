document.getElementById('dropzone').addEventListener('drop', async (e) => {
  e.preventDefault();
  const archivo = e.dataTransfer.files[0];
  
  if (!archivo) {
    alert('No se seleccionó ningún archivo');
    return;
  }
  
  // Validar que sea Excel
  if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
    alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    return;
  }
  
  console.log('Procesando archivo:', archivo.name);
  
  const repo = 'salpasistemas/import-pedidos';
  const path = `uploaded/${archivo.name}`; // ✅ Template literal correcto
  const branch = 'main';
  const token = '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'; 

  
  try {
    // Convertir archivo a base64
    const contenido = await archivo.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(contenido)));
    
    console.log('Subiendo archivo a GitHub...');
    
    // Subir a GitHub
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { // ✅ Template literal correcto
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`, // ✅ Header correcto
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Subir ${archivo.name}`, // ✅ Template literal correcto
        content: base64,
        branch: branch
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Archivo subido exitosamente:', result);
      alert(`¡Archivo ${archivo.name} subido correctamente! La acción se está ejecutando.`);
      
      // Abrir Actions en nueva pestaña
      setTimeout(() => {
        window.open(`https://github.com/${repo}/actions`, '_blank');
      }, 1000);
      
    } else {
      const error = await response.json();
      console.error('Error en la respuesta:', error);
      alert(`Error al subir archivo: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    alert(`Error: ${error.message}`);
  }
});

document.getElementById('dropzone').addEventListener('dragover', (e) => {
  e.preventDefault();
});

// También agregar soporte para click
document.getElementById('dropzone').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Crear evento drop simulado
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { files: [file] }
      };
      document.getElementById('dropzone').dispatchEvent(new CustomEvent('drop'));
      // Llamar directamente a la función
      document.getElementById('dropzone').addEventListener('drop', async (e) => {
        e.preventDefault();
        const archivo = file; // Usar el archivo seleccionado
        // ... resto del código igual
      });
    }
  };
  input.click();
});
