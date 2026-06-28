package com.inventory.service;

import com.inventory.exception.ProductNotFoundException;
import com.inventory.model.Product;
import com.inventory.model.ProductStatus;
import com.inventory.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private static final int LOW_STOCK_THRESHOLD = 10;

    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public List<Product> findAll() {
        return repository.findAll();
    }

    public List<Product> findByCategory(String category) {
        return repository.findByCategory(category);
    }

    public List<Product> findByStatus(ProductStatus status) {
        return repository.findByStatus(status);
    }

    public List<Product> search(String name) {
        return repository.findByNameContainingIgnoreCase(name);
    }

    public Product findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
    }

    public Product create(Product product) {
        product.setStatus(computeStatus(product.getQuantity()));
        return repository.save(product);
    }

    public Product update(Long id, Product updated) {
        Product existing = findById(id);
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        existing.setCategory(updated.getCategory());
        existing.setQuantity(updated.getQuantity());
        existing.setPrice(updated.getPrice());
        existing.setStatus(computeStatus(updated.getQuantity()));
        return repository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        repository.deleteById(id);
    }

    public List<String> findAllCategories() {
        return repository.findAll().stream()
                .map(Product::getCategory)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    private ProductStatus computeStatus(int quantity) {
        if (quantity == 0) return ProductStatus.OUT_OF_STOCK;
        if (quantity < LOW_STOCK_THRESHOLD) return ProductStatus.LOW_STOCK;
        return ProductStatus.IN_STOCK;
    }
}
