<?php

namespace App\Exceptions;

use RuntimeException;

class PlaylistProtectionException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Não foi possível acessar a configuração protegida da lista.');
    }
}
