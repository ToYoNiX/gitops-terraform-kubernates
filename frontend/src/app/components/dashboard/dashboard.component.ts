import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';

interface DashboardStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats = { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
  lowStockProducts: Product[] = [];
  loading = true;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.productService.getAll().subscribe({
      next: (products) => {
        this.stats = {
          total: products.length,
          inStock: products.filter(p => p.status === 'IN_STOCK').length,
          lowStock: products.filter(p => p.status === 'LOW_STOCK').length,
          outOfStock: products.filter(p => p.status === 'OUT_OF_STOCK').length,
          totalValue: products.reduce((sum, p) => sum + p.price * p.quantity, 0)
        };
        this.lowStockProducts = products.filter(p => p.status === 'LOW_STOCK' || p.status === 'OUT_OF_STOCK');
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}
