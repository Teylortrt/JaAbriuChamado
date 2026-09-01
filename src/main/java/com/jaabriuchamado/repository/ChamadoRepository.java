package com.jaabriuchamado.repository;

import com.jaabriuchamado.model.Chamado;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChamadoRepository extends JpaRepository<Chamado, Long> {
}
