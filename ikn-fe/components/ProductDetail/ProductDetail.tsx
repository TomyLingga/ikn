'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import ProductGallery from '@/components/ProductGallery';
import Breadcrumb from '@/components/Breadcrumb';
import StatusBadge from '@/components/StatusBadge';
import StarRating from '@/components/StarRating';
import AddToCart from '@/components/AddToCart';
import ProductCard from '@/components/ProductCard';
import ProductDetailPrice from '@/components/ProductDetailPrice';
import { useLang } from '@/components/LanguageProvider';
import { apiPaged, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { stockLabels } from '@/lib/commerce';
import { formatDate } from '@/lib/format';
import { useShopPaths } from '@/lib/shop';
import type { ProductDetail as ProductDetailData, ProductReview } from '@/lib/types';

interface Props {
  product: ProductDetailData;
  /** Jumlah ulasan per halaman dari GET /catalog/products/{slug}/reviews (default API 10). */
  reviewPageSize?: number;
}

// Halaman detail produk: galeri geser foto/video (images[]), harga efektif, spesifikasi, aplikasi, kelarutan,
// ulasan (reviews[] + paginasi lanjutan), dan produk terkait (related[]). Dipakai situs publik (/catalog/{slug})
// dan portal customer (/dashboard/katalog/{slug}); di portal semua tautan tetap di dalam portal.
export default function ProductDetail({ product, reviewPageSize = 10 }: Props) {
  const { lang } = useLang();
  const shop = useShopPaths();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const images = product.images?.length ? product.images : product.image ? [{ id: 0, url: product.image, sort: 0 }] : [];
  const [reviews, setReviews] = useState<ProductReview[]>(product.reviews || []);
  const [reviewPage, setReviewPage] = useState(1);
  const [hasMore, setHasMore] = useState((product.reviewCount || 0) > (product.reviews || []).length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const name = tr(product.name, lang);
  const stock = stockLabels[product.stockStatus] || stockLabels.out_of_stock;
  const highlights = product.highlights?.[lang]?.length ? product.highlights[lang] : product.highlights?.id || [];
  const applications = product.applications?.[lang]?.length ? product.applications[lang] : product.applications?.id || [];
  const specs = product.specs || [];
  const solubility = product.solubility || [];
  const related = product.related || [];
  const categoryName = tr(product.category?.name, lang) || t('Produk', 'Products');

  async function loadMoreReviews() {
    if (loadingMore) return;
    setLoadingMore(true);
    setReviewError('');
    try {
      const next = reviewPage + 1;
      const res = await apiPaged<ProductReview>(
        `/catalog/products/${encodeURIComponent(product.slug)}/reviews?page=${next}&perPage=${reviewPageSize}`,
      );
      setReviews((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.items.filter((r) => !seen.has(r.id))];
      });
      setReviewPage(next);
      setHasMore(next < res.meta.lastPage);
    } catch (err) {
      setReviewError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const reviewList = (
    reviews.length === 0 ? (
      <p className="pd-quote-note">{t('Belum ada ulasan untuk produk ini.', 'No reviews for this product yet.')}</p>
    ) : (
      <div>
        {reviews.map((r) => (
          <div key={r.id} className="review-item">
            <div className="review-head">
              <span className="review-author">{r.customer || t('Pelanggan', 'Customer')}</span>
              <StarRating value={r.rating} />
            </div>
            {r.body && <p>{r.body}</p>}
            <time className="review-date">{formatDate(r.date, lang)}</time>
          </div>
        ))}
        {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
        {hasMore && (
          <button type="button" className="btn btn-line btn-sm" style={{ marginTop: 16 }} onClick={loadMoreReviews} disabled={loadingMore}>
            {loadingMore ? t('Memuat…', 'Loading…') : t('Muat ulasan lainnya', 'Load more reviews')} <Icon name="arrowDown" />
          </button>
        )}
      </div>
    )
  );

  const moq = Math.max(1, product.moq || 1);
  const dims = product.dimensions;
  const dimsText = dims && dims.lengthCm && dims.widthCm && dims.heightCm ? `${dims.lengthCm} × ${dims.widthCm} × ${dims.heightCm} cm` : '';
  const quote = product.priceMode !== 'fixed';
  const facts: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }[] = [
    {
      label: t('Ketersediaan', 'Availability'),
      value: quote
        ? t('Konfirmasi lewat chat', 'Confirm via chat')
        : product.stockStatus === 'in_stock'
          ? `${product.available.toLocaleString('id-ID')} ${product.unit}`
          : product.stockStatus === 'made_to_order'
            ? t('Sesuai pesanan', 'Made to order')
            : t('Stok habis', 'Out of stock'),
      tone: quote ? undefined : stock.tone === 'ok' ? 'ok' : stock.tone === 'warn' ? 'warn' : 'bad',
    },
    ...(!quote ? [{ label: t('Minimum order', 'Minimum order'), value: `${moq.toLocaleString('id-ID')} ${product.unit}` }] : []),
    { label: t('Satuan', 'Unit'), value: product.unit },
    ...(product.weightGram > 0
      ? [{ label: t('Berat / satuan', 'Weight / unit'), value: product.weightGram >= 1000 ? `${(product.weightGram / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg` : `${product.weightGram} g` }]
      : []),
    ...(dimsText ? [{ label: t('Dimensi', 'Dimensions'), value: dimsText }] : []),
  ];

  // Portal customer: gallery + details on the left, a sticky buy box on the right (stacked on phones:
  // gallery, buy box, then details). All links stay inside the portal (lib/shop.ts).
  if (shop.portal) {
    return (
      <>
        <nav className="portal-crumbs" aria-label={t('Lokasi halaman', 'Breadcrumb')}>
          <Link href={shop.catalog}>
            <Icon name="chevronLeft" size={16} /> {t('Belanja produk', 'Shop products')}
          </Link>
          {product.category && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={shop.category(product.category.slug)}>{categoryName}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{name}</span>
        </nav>

        <div className="pdp">
          <div className="pdp-gallery">
            <ProductGallery media={images} name={name} code={product.code} poster={product.image} />
          </div>

          <aside className="pdp-aside">
            <div className="pdp-buybox">
              <span className="pdp-kind">
                {product.kind || categoryName}
                <span className="pdp-code">{product.code}</span>
              </span>
              <h1 className="pd-title">{name}</h1>
              <div className="pd-meta">
                <StatusBadge label={stock[lang] || stock.id} tone={stock.tone} />
                {product.reviewCount > 0 && <StarRating value={product.ratingAvg} count={product.reviewCount} />}
              </div>

              <ProductDetailPrice product={product} />

              <dl className="pdp-facts">
                {facts.map((f) => (
                  <div key={f.label} className={f.tone ? `is-${f.tone}` : undefined}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>

              <AddToCart product={product} />
            </div>
          </aside>

          <div className="pdp-content">
            {(tr(product.summary, lang) || highlights.length > 0) && (
              <section className="pdp-card">
                <h2 className="pd-sec-title">{t('Tentang produk', 'About this product')}</h2>
                {tr(product.summary, lang) && <p className="pd-summary">{tr(product.summary, lang)}</p>}
                {highlights.length > 0 && (
                  <ul className="pd-highlights">
                    {highlights.map((h) => (
                      <li key={h}><Icon name="check" size={16} /> {h}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {specs.length > 0 && (
              <section className="pdp-card">
                <h2 className="pd-sec-title">{t('Spesifikasi teknis', 'Technical specifications')}</h2>
                <table className="pdp-spec">
                  <tbody>
                    {specs.map(([k, v], i) => (
                      <tr key={`${k}-${i}`}>
                        <th scope="row">{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {(applications.length > 0 || solubility.length > 0) && (
              <section className="pdp-card pdp-split">
                {applications.length > 0 && (
                  <div>
                    <h2 className="pd-sec-title">{t('Aplikasi', 'Applications')}</h2>
                    <ul className="pdp-tags">
                      {applications.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {solubility.length > 0 && (
                  <div>
                    <h2 className="pd-sec-title">{t('Kelarutan', 'Solubility')}</h2>
                    <table className="pdp-spec">
                      <tbody>
                        {solubility.map(([k, v], i) => (
                          <tr key={`${k}-${i}`}>
                            <th scope="row">{k}</th>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <section className="pdp-card">
              <h2 className="pd-sec-title">
                {t('Ulasan pelanggan', 'Customer reviews')}
                {product.reviewCount > 0 && (
                  <span className="pdp-rating">
                    <strong>{product.ratingAvg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</strong>/5 · {product.reviewCount} {t('ulasan', product.reviewCount === 1 ? 'review' : 'reviews')}
                  </span>
                )}
              </h2>
              {reviewList}
            </section>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pd-related">
            <div className="pdp-related-head">
              <h2 className="pd-sec-title">{t('Produk terkait', 'Related products')}</h2>
              <Link href={product.category ? shop.category(product.category.slug) : shop.catalog} className="link">
                {t('Lihat semua', 'View all')} <Icon name="arrow" size={15} />
              </Link>
            </div>
            <div className="pgrid">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb
            items={[
              { label: t('Beranda', 'Home'), href: '/' },
              { label: t('Katalog', 'Catalog'), href: shop.catalog },
              ...(product.category ? [{ label: categoryName, href: shop.category(product.category.slug) }] : []),
              { label: name },
            ]}
          />
        </div>
      </section>

      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="pd-grid">
            <ProductGallery media={images} name={name} code={product.code} poster={product.image} />

            <div className="pd-info">
              <span className="pcard-kind">{product.kind || categoryName}</span>
              <h1 className="pd-title">{name}</h1>

              <div className="pd-meta">
                <StatusBadge label={stock[lang] || stock.id} tone={stock.tone} />
                {product.reviewCount > 0 && <StarRating value={product.ratingAvg} count={product.reviewCount} />}
              </div>

              <p className="pd-summary">{tr(product.summary, lang)}</p>

              <ProductDetailPrice product={product} />

              {highlights.length > 0 && (
                <ul className="pd-highlights">
                  {highlights.map((h) => (
                    <li key={h}><Icon name="check" size={16} /> {h}</li>
                  ))}
                </ul>
              )}

              <AddToCart product={product} />
            </div>
          </div>

          {(specs.length > 0 || applications.length > 0 || solubility.length > 0) && (
            <div className="pd-detail-grid">
              {specs.length > 0 && (
                <div>
                  <h2 className="h3 pd-sec-title">{t('Spesifikasi teknis', 'Technical specifications')}</h2>
                  <div className="spec-table">
                    {specs.map(([k, v], i) => (
                      <div key={`${k}-${i}`} className="spec-row">
                        <span className="spec-key">{k}</span>
                        <span className="spec-val">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                {applications.length > 0 && (
                  <>
                    <h2 className="h3 pd-sec-title">{t('Aplikasi', 'Applications')}</h2>
                    <ul className="pd-app-list">
                      {applications.map((a) => (
                        <li key={a}><Icon name="arrow" size={15} /> {a}</li>
                      ))}
                    </ul>
                  </>
                )}

                {solubility.length > 0 && (
                  <>
                    <h2 className="h3 pd-sec-title" style={{ marginTop: 30 }}>{t('Kelarutan', 'Solubility')}</h2>
                    <div className="spec-table">
                      {solubility.map(([k, v], i) => (
                        <div key={`${k}-${i}`} className="spec-row">
                          <span className="spec-key">{k}</span>
                          <span className="spec-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="pd-reviews">
            <h2 className="h3 pd-sec-title">
              {t('Ulasan pelanggan', 'Customer reviews')}
              {product.reviewCount > 0 && <span className="cat-count" style={{ marginLeft: 10 }}>{product.reviewCount}</span>}
            </h2>
            {reviewList}
          </div>

          {related.length > 0 && (
            <div className="pd-related">
              <h2 className="h3 pd-sec-title">{t('Produk terkait', 'Related products')}</h2>
              <div className="pgrid">
                {related.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
