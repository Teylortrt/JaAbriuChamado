package com.jaabriuchamado.dto;

import com.jaabriuchamado.model.Prioridade;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CriarChamadoRequest(
        @NotBlank @Size(max = 120) String titulo,
        @NotBlank @Size(max = 2000) String descricao,
        @NotBlank @Size(max = 120) String solicitante,
        @NotBlank @Size(max = 80) String categoria,
        @NotNull Prioridade prioridade
) {}
