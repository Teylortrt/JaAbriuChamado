package com.jaabriuchamado.dto;

import com.jaabriuchamado.model.StatusChamado;
import jakarta.validation.constraints.NotNull;

public record AtualizarStatusRequest(@NotNull StatusChamado status) {}
