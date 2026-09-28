<?php

namespace App\Models;

class Setting extends Model
{
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['key', 'value', 'group', 'is_public'];

    protected $casts = ['value' => 'array', 'is_public' => 'boolean'];

    public static function getValue(string $key, $default = null)
    {
        $row = static::find($key);

        return $row ? $row->value : $default;
    }

    public static function putValue(string $key, $value, string $group = 'general', bool $isPublic = false): self
    {
        return static::updateOrCreate(['key' => $key], ['value' => $value, 'group' => $group, 'is_public' => $isPublic]);
    }
}
