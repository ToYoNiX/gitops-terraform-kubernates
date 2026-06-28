package com.inventory;

import com.inventory.exception.ProductNotFoundException;
import com.inventory.model.Product;
import com.inventory.model.ProductStatus;
import com.inventory.repository.ProductRepository;
import com.inventory.service.ProductService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository repository;

    @InjectMocks
    private ProductService service;

    private Product product;

    @BeforeEach
    void setUp() {
        product = new Product();
        product.setId(1L);
        product.setName("Test Product");
        product.setCategory("Electronics");
        product.setQuantity(20);
        product.setPrice(99.99);
        product.setStatus(ProductStatus.IN_STOCK);
    }

    @Test
    void findAll_returnsAllProducts() {
        when(repository.findAll()).thenReturn(List.of(product));
        assertThat(service.findAll()).hasSize(1);
    }

    @Test
    void findById_existingId_returnsProduct() {
        when(repository.findById(1L)).thenReturn(Optional.of(product));
        assertThat(service.findById(1L).getName()).isEqualTo("Test Product");
    }

    @Test
    void findById_missingId_throwsNotFoundException() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.findById(99L))
                .isInstanceOf(ProductNotFoundException.class);
    }

    @Test
    void create_setsStatusInStock_whenQuantityAboveThreshold() {
        product.setQuantity(20);
        when(repository.save(any())).thenReturn(product);
        Product saved = service.create(product);
        assertThat(saved.getStatus()).isEqualTo(ProductStatus.IN_STOCK);
    }

    @Test
    void create_setsStatusLowStock_whenQuantityBelowThreshold() {
        product.setQuantity(5);
        product.setStatus(null);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Product saved = service.create(product);
        assertThat(saved.getStatus()).isEqualTo(ProductStatus.LOW_STOCK);
    }

    @Test
    void create_setsStatusOutOfStock_whenQuantityIsZero() {
        product.setQuantity(0);
        product.setStatus(null);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Product saved = service.create(product);
        assertThat(saved.getStatus()).isEqualTo(ProductStatus.OUT_OF_STOCK);
    }

    @Test
    void delete_existingId_callsRepository() {
        when(repository.findById(1L)).thenReturn(Optional.of(product));
        service.delete(1L);
        verify(repository, times(1)).deleteById(1L);
    }

    @Test
    void delete_missingId_throwsNotFoundException() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(99L))
                .isInstanceOf(ProductNotFoundException.class);
        verify(repository, never()).deleteById(any());
    }
}
