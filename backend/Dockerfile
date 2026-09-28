# Laravel 12 (PHP ^8.2, per composer.json) served by Apache, for Render's
# Docker runtime.
FROM php:8.2-apache

# System libraries needed to build the PHP extensions below (gd needs the
# image libs, zip needs libzip, mbstring needs oniguruma). unzip/zip are
# for Composer's package extraction.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libonig-dev \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/*

# PHP extensions actually required by this app:
# - pdo_mysql: the app's database driver (config/database.php -> mysql)
# - mbstring:  required by laravel/framework itself
# - gd, zip:   required by phpoffice/phpspreadsheet (see composer.lock)
# Everything else phpspreadsheet/laravel need (ctype, dom, fileinfo,
# filter, iconv, libxml, simplexml, xml, xmlreader, xmlwriter, hash,
# openssl, session, tokenizer) already ships enabled in this base image.
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring gd zip

# Laravel's routing depends on public/.htaccess, which needs mod_rewrite.
RUN a2enmod rewrite

# Point Apache at Laravel's public/ directory and allow .htaccess to
# actually take effect there (the base image's default vhost points at
# /var/www/html with no AllowOverride, which would 404 every route).
RUN { \
        echo '<VirtualHost *:80>'; \
        echo '    DocumentRoot /var/www/html/public'; \
        echo '    <Directory /var/www/html/public>'; \
        echo '        AllowOverride All'; \
        echo '        Require all granted'; \
        echo '    </Directory>'; \
        echo '    ErrorLog ${APACHE_LOG_DIR}/error.log'; \
        echo '    CustomLog ${APACHE_LOG_DIR}/access.log combined'; \
        echo '</VirtualHost>'; \
    } > /etc/apache2/sites-available/000-default.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress

# Laravel needs these two directories to be writable by the web server user.
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Render injects the real PORT at container start (not at build time), so
# Apache's static "80" config is rewritten to it right before starting.
ENV PORT=10000
EXPOSE 10000

CMD ["/bin/sh", "-c", "sed -i \"s/80/${PORT}/g\" /etc/apache2/ports.conf /etc/apache2/sites-enabled/000-default.conf && apache2-foreground"]
