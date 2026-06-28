import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { ProductService } from '../../services/product.service';
import { Product, ProductStatus } from '../../models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule, MatCardModule
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit {
  products: Product[] = [];
  categories: string[] = [];
  loading = true;

  searchText = '';
  selectedCategory = '';
  selectedStatus: ProductStatus | '' = '';

  displayedColumns = ['name', 'category', 'quantity', 'price', 'status', 'actions'];

  constructor(
    private productService: ProductService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getAll({
      search: this.searchText || undefined,
      category: this.selectedCategory || undefined,
      status: this.selectedStatus || undefined
    }).subscribe({
      next: (products) => { this.products = products; this.loading = false; },
      error: () => {
        this.snackBar.open('Failed to load products', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadCategories(): void {
    this.productService.getCategories().subscribe({
      next: (cats) => { this.categories = cats; }
    });
  }

  onFilterChange(): void {
    this.loadProducts();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.loadProducts();
  }

  confirmDelete(product: Product): void {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    this.productService.delete(product.id!).subscribe({
      next: () => {
        this.snackBar.open(`"${product.name}" deleted`, 'Close', { duration: 3000 });
        this.loadProducts();
        this.loadCategories();
      },
      error: () => {
        this.snackBar.open('Failed to delete product', 'Close', { duration: 3000 });
      }
    });
  }
}
