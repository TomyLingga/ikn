'use client';

import { useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
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
import type { ProductDetail as ProductDetailData, ProductReview } from '@/lib/types';

interface Props {
  product: ProductDetailData;
  /** Jumlah ulasan per halaman dari GET /catalog/products/{slug}/reviews (default API 10). */
  reviewPageSize?: number;
}

// Halaman detail produk: galeri (images[]), harga efektif, spesifikasi, aplikasi, kelarutan,
// ulasan (reviews[] + paginasi lanjutan), dan produk terkait (related[]).
export default function ProductDetail({ product, reviewPageSize = 10 }: Props) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const images = product.images?.length ? product.images : product.image ? [{ id: 0, url: product.image, sort: 0 }] : [];
  const [active, setActive] = useState(0);
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
  const activeImage = images[Math.min(active, Math.max(0, images.length - 1))];

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

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb
            items={[
              { label: t('Beranda', 'Home'), href: '/' },
              { label: t('Katalog', 'Catalog'), href: '/catalog' },
              ...(product.category ? [{ label: categoryName, href: `/catalog/kategori/${product.category.slug}` }] : []),
              { label: name },
            ]}
          />
        </div>
      </section>

      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="pd-grid">
            <div className="pd-gallery">
              <div className="pd-media">
                {activeImage ? (
                  <Image src={activeImage.url} alt={name} fill sizes="(max-width:900px) 100vw, 520px" style={{ objectFit: 'cover' }} priority />
                ) : (
                  <span className="pd-drop"><Icon name="drop" size={90} strokeWidth={0.8} /></span>
                )}
                <span className="pd-code">{product.code}</span>
              </div>
              {images.length > 1 && (
                <div className="pd-thumbs" role="tablist" aria-label={t('Galeri produk', 'Product gallery')}>
                  {images.map((img, i) => (
                    <button
                      key={img.id || img.url}
                      type="button"
                      role="tab"
                      aria-selected={i === active}
                      className={`pd-thumb ${i === active ? 'is-active' : ''}`}
                      onClick={() => setActive(i)}
                    >
                      <Image src={img.url} alt={`${name} ${i + 1}`} fill sizes="80px" style={{ objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

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
            {reviews.length === 0 ? (
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
            )}
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
