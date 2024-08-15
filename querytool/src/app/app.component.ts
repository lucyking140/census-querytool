import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DatabaseSelectionComponent } from './database-selection/database-selection.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DatabaseSelectionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'querytool'; 
}
