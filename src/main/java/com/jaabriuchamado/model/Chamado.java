package com.jaabriuchamado.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chamados")
public class Chamado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String titulo;

    @Column(nullable = false, length = 2000)
    private String descricao;

    @Column(nullable = false, length = 120)
    private String solicitante;

    @Column(nullable = false, length = 80)
    private String categoria;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Prioridade prioridade;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusChamado status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime criadoEm;

    protected Chamado() {
    }

    public Chamado(String titulo, String descricao, String solicitante, String categoria, Prioridade prioridade) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.solicitante = solicitante;
        this.categoria = categoria;
        this.prioridade = prioridade;
        this.status = StatusChamado.ABERTO;
        this.criadoEm = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getTitulo() { return titulo; }
    public String getDescricao() { return descricao; }
    public String getSolicitante() { return solicitante; }
    public String getCategoria() { return categoria; }
    public Prioridade getPrioridade() { return prioridade; }
    public StatusChamado getStatus() { return status; }
    public LocalDateTime getCriadoEm() { return criadoEm; }
    public void setStatus(StatusChamado status) { this.status = status; }
}
