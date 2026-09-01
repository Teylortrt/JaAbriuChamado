package com.jaabriuchamado.service;

import com.jaabriuchamado.dto.AtualizarStatusRequest;
import com.jaabriuchamado.dto.CriarChamadoRequest;
import com.jaabriuchamado.exception.RecursoNaoEncontradoException;
import com.jaabriuchamado.model.Chamado;
import com.jaabriuchamado.repository.ChamadoRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ChamadoService {
    private final ChamadoRepository chamadoRepository;

    public ChamadoService(ChamadoRepository chamadoRepository) {
        this.chamadoRepository = chamadoRepository;
    }

    public List<Chamado> listar() {
        return chamadoRepository.findAll();
    }

    public Chamado buscarPorId(Long id) {
        return chamadoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Chamado não encontrado."));
    }

    public Chamado criar(CriarChamadoRequest request) {
        Chamado chamado = new Chamado(request.titulo(), request.descricao(), request.solicitante(),
                request.categoria(), request.prioridade());
        return chamadoRepository.save(chamado);
    }

    public Chamado atualizarStatus(Long id, AtualizarStatusRequest request) {
        Chamado chamado = buscarPorId(id);
        chamado.setStatus(request.status());
        return chamadoRepository.save(chamado);
    }
}
