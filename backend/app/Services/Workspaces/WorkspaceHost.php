<?php

namespace App\Services\Workspaces;

/** One machine running workspace containers, plus the gateway domain that fronts it. */
final readonly class WorkspaceHost
{
    public function __construct(
        public string $name,
        public ?string $dockerHost,
        public int $capacity,
        public string $domain,
        public string $scheme = 'https',
        public bool $tlsVerify = false,
        public ?string $certPath = null,
    ) {}

    /** @param array<string, mixed> $config one entry of config('workspaces.hosts') */
    public static function fromConfig(array $config): self
    {
        return new self(
            name: (string) $config['name'],
            dockerHost: ! empty($config['docker_host']) ? (string) $config['docker_host'] : null,
            capacity: max(1, (int) ($config['capacity'] ?? 1)),
            domain: (string) $config['domain'],
            scheme: (string) ($config['scheme'] ?? 'https'),
            tlsVerify: (bool) ($config['tls_verify'] ?? false),
            certPath: ! empty($config['cert_path']) ? (string) $config['cert_path'] : null,
        );
    }

    /**
     * Environment for the docker CLI. Empty for the local engine, so the CLI's
     * own defaults (named pipe / unix socket) apply.
     *
     * @return array<string, string>
     */
    public function dockerEnv(): array
    {
        $env = [];

        if ($this->dockerHost !== null) {
            $env['DOCKER_HOST'] = $this->dockerHost;
        }

        if ($this->tlsVerify) {
            $env['DOCKER_TLS_VERIFY'] = '1';
        }

        if ($this->certPath !== null) {
            $env['DOCKER_CERT_PATH'] = $this->certPath;
        }

        return $env;
    }

    /** https://ws-<id>.ws.example.com — `$label` is the DNS label, e.g. "ws-abc…" or "p5173--ws-abc…". */
    public function urlFor(string $label, string $path = '/'): string
    {
        return "{$this->scheme}://{$label}.{$this->domain}{$path}";
    }
}
