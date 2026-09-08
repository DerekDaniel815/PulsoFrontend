import { Component } from '@angular/core';

@Component({
  selector: 'app-historial',
  template: `
    <section class="page">
      <div class="page-head">
        <h1>Historial</h1>
        <p>Recorrido de ubicaciones por dispositivo asignado.</p>
      </div>
      <article class="card empty-card">
        Timeline de puntos GPS. Se alimentará con el endpoint de historial.
      </article>
    </section>
  `,
})
export class Historial {}
