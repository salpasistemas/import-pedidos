document.getElementById('dropzone').addEventListener('drop', async (e) => {
  e.preventDefault();
  const archivo = e.dataTransfer.files[0];

  const repo = 'salpasistemas/import-pedidos';
  const path = `uploaded/${archivo.name}`;
  const branch = 'main';
  const token = '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';

  const contenido = await archivo.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(contenido)));

  await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
    },
    body: JSON.stringify({
      message: `Subir ${archivo.name}`,
      content: base64,
      branch
    })
  });

  alert('¡Archivo subido correctamente! La acción se está ejecutando.');
});

document.getElementById('dropzone').addEventListener('dragover', (e) => {
  e.preventDefault();
});
