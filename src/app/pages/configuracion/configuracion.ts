import { Component } from '@angular/core';

@Component({
  selector: 'app-configuracion',
  template: `
    <section class="page">
      <div class="page-head">
        <h1>Configuración</h1>
        <p>Perfil, visibilidad (SOLO_YO / GRUPO / PUBLICO) y dispositivos vinculados.</p>
      </div>
      <article class="card empty-card">
        Preferencias de cuenta y dispositivo. Por ahora solo deja el espacio de la vista.
      </article>
    </section>
  `,
})
export class Configuracion {}
