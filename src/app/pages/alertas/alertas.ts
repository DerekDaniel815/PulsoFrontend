import { Component } from '@angular/core';

@Component({
  selector: 'app-alertas',
  template: `
    <section class="page">
      <div class="page-head">
        <h1>Alertas</h1>
        <p>Emergencias activas y notificaciones. Datos mock mientras se conecta la API.</p>
      </div>
      <article class="card empty-card">
        1 emergencia ACTIVA · Carlos Rodríguez · código público de consulta.
      </article>
    </section>
  `,
})
export class Alertas {}
