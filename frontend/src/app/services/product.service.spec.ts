import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProductService } from './product.service';
import { Product } from '../models/product.model';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all products', () => {
    const mock: Product[] = [
      { id: 1, name: 'Drill', category: 'Tools', quantity: 5, price: 49.99 },
    ];

    service.getAll().subscribe(products => {
      expect(products.length).toBe(1);
      expect(products[0].name).toBe('Drill');
    });

    const req = httpMock.expectOne(r => r.url.includes('/api/products') && r.method === 'GET');
    req.flush(mock);
  });

  it('should create a product', () => {
    const payload: Product = { name: 'Hammer', category: 'Tools', quantity: 10, price: 9.99 };
    const response: Product = { id: 2, ...payload };

    service.create(payload).subscribe(p => expect(p.id).toBe(2));

    const req = httpMock.expectOne(r => r.url.includes('/api/products') && r.method === 'POST');
    req.flush(response);
  });

  it('should delete a product', () => {
    service.delete(1).subscribe();

    const req = httpMock.expectOne(r => r.url.includes('/api/products/1') && r.method === 'DELETE');
    req.flush(null);
  });

  it('should fetch categories', () => {
    service.getCategories().subscribe(cats => expect(cats).toContain('Tools'));

    const req = httpMock.expectOne(r => r.url.includes('/api/products/categories'));
    req.flush(['Tools', 'Electronics']);
  });
});
