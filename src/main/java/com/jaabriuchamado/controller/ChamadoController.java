package com.jaabriuchamado.controller;

import com.jaabriuchamado.dto.AtualizarStatusRequest;
import com.jaabriuchamado.dto.CriarChamadoRequest;
import com.jaabriuchamado.model.Chamado;
import com.jaabriuchamado.service.ChamadoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/chamados")
public class ChamadoController {
    private final ChamadoService chamadoService;

    public ChamadoController(ChamadoService chamadoService) {
        this.chamadoService = chamadoService;
    }

    @GetMapping
    public List<Chamado> listar() {
        return chamadoService.listar();
    }

    @GetMapping("/{id}")
    public Chamado buscarPorId(@PathVariable Long id) {
        return chamadoService.buscarPorId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Chamado criar(@Valid @RequestBody CriarChamadoRequest request) {
        return chamadoService.criar(request);
    }

    @PatchMapping("/{id}/status")
    public Chamado atualizarStatus(@PathVariable Long id, @Valid @RequestBody AtualizarStatusRequest request) {
        return chamadoService.atualizarStatus(id, request);
    }
}
